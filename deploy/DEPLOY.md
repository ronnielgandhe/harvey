# Harvey — Deploy Zoom Script

Two stacks:

1. **Frontend → Vercel** (Next.js app in `frontend/`)
2. **Agent worker → AWS ECS Fargate** (Python LiveKit agent in `backend/`)

LiveKit Cloud is the meeting point. Frontend gets a room token from
`/api/token`, user joins the room, LiveKit Cloud dispatches the call
to the agent worker, agent worker joins the same room, they talk.

---

## Prerequisites (5 min)

You need these CLIs installed + logged in:

```bash
# Docker with buildx (for linux/amd64 cross-build on an M-series Mac)
docker --version && docker buildx version

# AWS CLI v2 — configured with a user/role that can create:
#   ECR repos, ECS clusters/services, IAM roles, Secrets Manager, CloudWatch log groups
aws --version && aws sts get-caller-identity

# gh (optional, for Vercel link setup)
gh --version
```

Set region + account ID once so you don't fat-finger them:

```bash
export AWS_REGION=us-east-1
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo "Deploying to $AWS_ACCOUNT_ID in $AWS_REGION"
```

---

## Part 1 — Vercel Frontend (8 min)

> You can run this in a separate terminal tab in parallel with Part 2.

1. Push the repo to GitHub if you haven't (you already did).
2. Go to https://vercel.com/new.
3. Import the `harvey` repo.
4. **Root Directory**: `frontend`.
5. **Framework Preset**: Next.js (auto-detected).
6. **Environment Variables** (click "Add"):

   | Name                      | Value                                 |
   |---------------------------|---------------------------------------|
   | `LIVEKIT_API_KEY`         | from LiveKit Cloud project settings   |
   | `LIVEKIT_API_SECRET`      | from LiveKit Cloud project settings   |
   | `NEXT_PUBLIC_LIVEKIT_URL` | `wss://<your-project>.livekit.cloud`  |

7. Click **Deploy**. Takes ~2 min. Copy the `*.vercel.app` URL.

The frontend alone won't work until the agent is live in Part 2, but
you can already test the page renders.

---

## Part 2 — AWS ECS Fargate Agent (35-45 min)

### 2.1 Build + push the agent image (10 min)

From the repo root:

```bash
# Create the ECR repository
aws ecr create-repository \
  --repository-name harvey-agent \
  --region $AWS_REGION

# Authenticate Docker with ECR
aws ecr get-login-password --region $AWS_REGION \
  | docker login --username AWS --password-stdin \
      $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

# Build for linux/amd64 explicitly (you're on an M-series Mac; Fargate is amd64)
docker buildx build \
  --platform linux/amd64 \
  -t $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/harvey-agent:latest \
  -f backend/Dockerfile \
  --push \
  .
```

The `--push` flag sends the image straight to ECR during build. Image
is ~1.5GB (Chroma DB + torch CPU wheels); first push takes a few min.

### 2.2 Create the secrets (4 min)

These 7 values come from `backend/.env` on your machine. Replace the
`<value>` placeholders with the real strings (or use `--secret-string
file://-` + paste).

```bash
for KEY in LIVEKIT_URL LIVEKIT_API_KEY LIVEKIT_API_SECRET \
           OPENAI_API_KEY DEEPGRAM_API_KEY \
           ELEVENLABS_API_KEY ELEVENLABS_VOICE_ID; do
  read -sp "Value for $KEY: " VAL; echo
  aws secretsmanager create-secret \
    --name "harvey/$KEY" \
    --secret-string "$VAL" \
    --region $AWS_REGION \
    --output text --query ARN
done
```

### 2.3 Create the execution role (4 min)

The task execution role lets ECS (a) pull the image from ECR and
(b) resolve the Secrets Manager ARNs into env vars at container start.

```bash
# Interpolate account/region placeholders into the inline policy
sed -e "s/<ACCOUNT_ID>/$AWS_ACCOUNT_ID/g" \
    -e "s/<REGION>/$AWS_REGION/g" \
    deploy/secrets-inline-policy.json > /tmp/secrets-inline-policy.json

# Create the role with the trust policy
aws iam create-role \
  --role-name harveyTaskExecutionRole \
  --assume-role-policy-document file://deploy/trust-policy.json

# Attach the AWS-managed execution policy (ECR pull + CloudWatch logs)
aws iam attach-role-policy \
  --role-name harveyTaskExecutionRole \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy

# Attach the inline policy that allows reading harvey/* secrets
aws iam put-role-policy \
  --role-name harveyTaskExecutionRole \
  --policy-name HarveySecretsRead \
  --policy-document file:///tmp/secrets-inline-policy.json
```

### 2.4 Register the task definition (2 min)

```bash
# Interpolate account/region placeholders
sed -e "s/<ACCOUNT_ID>/$AWS_ACCOUNT_ID/g" \
    -e "s/<REGION>/$AWS_REGION/g" \
    deploy/task-definition.json > /tmp/task-definition.json

aws ecs register-task-definition \
  --cli-input-json file:///tmp/task-definition.json \
  --region $AWS_REGION
```

### 2.5 Create the cluster + service (5 min)

```bash
# Cluster (one-time)
aws ecs create-cluster \
  --cluster-name harvey \
  --region $AWS_REGION

# Find a default-VPC public subnet + the default security group.
# The agent is outbound-only, so the default SG (outbound: all) is fine.
DEFAULT_VPC=$(aws ec2 describe-vpcs --filters "Name=isDefault,Values=true" \
  --query 'Vpcs[0].VpcId' --output text --region $AWS_REGION)
SUBNET_ID=$(aws ec2 describe-subnets --filters "Name=vpc-id,Values=$DEFAULT_VPC" \
  --query 'Subnets[0].SubnetId' --output text --region $AWS_REGION)
DEFAULT_SG=$(aws ec2 describe-security-groups --filters "Name=vpc-id,Values=$DEFAULT_VPC" "Name=group-name,Values=default" \
  --query 'SecurityGroups[0].GroupId' --output text --region $AWS_REGION)

echo "VPC=$DEFAULT_VPC  SUBNET=$SUBNET_ID  SG=$DEFAULT_SG"

# Service — one task, Fargate, public IP ON (the agent needs to reach
# LiveKit Cloud + OpenAI + Deepgram + ElevenLabs over the internet).
aws ecs create-service \
  --cluster harvey \
  --service-name harvey-agent \
  --task-definition harvey-agent \
  --desired-count 1 \
  --launch-type FARGATE \
  --platform-version 1.4.0 \
  --network-configuration "awsvpcConfiguration={subnets=[$SUBNET_ID],securityGroups=[$DEFAULT_SG],assignPublicIp=ENABLED}" \
  --region $AWS_REGION
```

### 2.6 Smoke test (3 min)

```bash
# Wait for the service to hit RUNNING
aws ecs describe-services \
  --cluster harvey --services harvey-agent \
  --query 'services[0].runningCount' --output text --region $AWS_REGION

# Stream logs — you want to see "registered worker"
aws logs tail /ecs/harvey-agent --follow --region $AWS_REGION
```

When you see something like:

```
INFO     livekit.agents     registered worker
```

…the agent is live. Hit the Vercel URL from Part 1 and start a call.

---

## Redeploys

Agent code changed? Rebuild + re-push + force a new deployment:

```bash
docker buildx build --platform linux/amd64 \
  -t $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/harvey-agent:latest \
  -f backend/Dockerfile --push .

aws ecs update-service \
  --cluster harvey --service harvey-agent \
  --force-new-deployment --region $AWS_REGION
```

Frontend-only change? `git push` → Vercel auto-deploys.

---

## Tear-down (at project end)

```bash
aws ecs update-service --cluster harvey --service harvey-agent --desired-count 0 --region $AWS_REGION
aws ecs delete-service  --cluster harvey --service harvey-agent --force --region $AWS_REGION
aws ecs delete-cluster  --cluster harvey --region $AWS_REGION
aws ecr delete-repository --repository-name harvey-agent --force --region $AWS_REGION
aws iam delete-role-policy --role-name harveyTaskExecutionRole --policy-name HarveySecretsRead
aws iam detach-role-policy --role-name harveyTaskExecutionRole --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy
aws iam delete-role --role-name harveyTaskExecutionRole
for KEY in LIVEKIT_URL LIVEKIT_API_KEY LIVEKIT_API_SECRET OPENAI_API_KEY DEEPGRAM_API_KEY ELEVENLABS_API_KEY ELEVENLABS_VOICE_ID; do
  aws secretsmanager delete-secret --secret-id "harvey/$KEY" --force-delete-without-recovery --region $AWS_REGION
done
```

---

## Trip-wires (if you lose 30 min, it's one of these)

1. **`assignPublicIp=DISABLED`** — agent can't reach the internet. Must be `ENABLED` on the service or put it behind a NAT gateway.
2. **Architecture mismatch** — M-series Mac default build is `arm64`; Fargate x86 task will crash. Always `--platform linux/amd64`.
3. **Secrets ARN wrong** — copy-paste the ARN returned by `create-secret` or use `aws secretsmanager describe-secret --secret-id harvey/KEY --query ARN`. Note the random 6-char suffix AWS appends; the task def uses the stripped `arn:...:secret:harvey/KEY` form which also resolves.
4. **`platform-version: 1.4.0`** — anything older can't pull secrets → env vars.
5. **Build hangs on torch** — the CPU-only wheel is 200MB. First build takes a while, cached after.
