#!/usr/bin/env bash
# Phase B of the AWS deploy — runs AFTER the docker image has been pushed to ECR.
# Creates secrets, IAM role, task def, cluster, and service. Tails the log at the end.
#
# Usage:
#   cd /Users/ronniel/Desktop/harvey
#   bash deploy/phase-b.sh
#
# Requirements:
#   - aws CLI authenticated (aws sts get-caller-identity must succeed)
#   - docker image already built + pushed to ECR (Phase A)
#   - run FROM the repo root so the sed targets under deploy/ resolve

set -euo pipefail

export AWS_REGION=us-east-1
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo "Account: $AWS_ACCOUNT_ID, Region: $AWS_REGION"

# ---------------------------------------------------------------------------
# Secrets — 7 values into AWS Secrets Manager. Idempotent: if a secret
# already exists, put-secret-value updates it instead of failing.
# ---------------------------------------------------------------------------
put_secret() {
  local name="$1"
  local val="$2"
  if aws secretsmanager describe-secret --secret-id "$name" --region "$AWS_REGION" >/dev/null 2>&1; then
    aws secretsmanager put-secret-value --secret-id "$name" --secret-string "$val" --region "$AWS_REGION" >/dev/null
    echo "updated secret: $name"
  else
    aws secretsmanager create-secret --name "$name" --secret-string "$val" --region "$AWS_REGION" >/dev/null
    echo "created secret: $name"
  fi
}

put_secret harvey/LIVEKIT_URL          'wss://harvey-ppqpwwmf.livekit.cloud'
put_secret harvey/LIVEKIT_API_KEY      'APIJZP2MvQGwRZ3'
put_secret harvey/LIVEKIT_API_SECRET   'M6sXw2UvQwDYgwFsIz9OX4lhzUlJSfRSfsOR3UQYis0'
put_secret harvey/OPENAI_API_KEY       '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'
put_secret harvey/DEEPGRAM_API_KEY     'fb0aab80a6287a99b2feb71ad3142557dabf6b2e'
put_secret harvey/ELEVENLABS_API_KEY   'sk_a8a32d106f494f4a09d7fc9a292cb01d09a360528c3b3f21'
put_secret harvey/ELEVENLABS_VOICE_ID  'zKrDZgdznctDasaOp22c'

# ---------------------------------------------------------------------------
# IAM execution role — lets the Fargate task pull the image from ECR +
# resolve those Secrets Manager references into env vars at boot.
# ---------------------------------------------------------------------------
sed -e "s/<ACCOUNT_ID>/$AWS_ACCOUNT_ID/g" -e "s/<REGION>/$AWS_REGION/g" \
  deploy/secrets-inline-policy.json > /tmp/secrets-inline-policy.json

if aws iam get-role --role-name harveyTaskExecutionRole >/dev/null 2>&1; then
  echo "role harveyTaskExecutionRole already exists; skipping create"
else
  aws iam create-role --role-name harveyTaskExecutionRole \
    --assume-role-policy-document file://deploy/trust-policy.json >/dev/null
  echo "created role: harveyTaskExecutionRole"
fi

aws iam attach-role-policy --role-name harveyTaskExecutionRole \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy || true

aws iam put-role-policy --role-name harveyTaskExecutionRole \
  --policy-name HarveySecretsRead \
  --policy-document file:///tmp/secrets-inline-policy.json
echo "policies attached"

echo "Waiting 8 seconds for IAM role to propagate..."
sleep 8

# ---------------------------------------------------------------------------
# Task definition — interpolate placeholders, register.
# ---------------------------------------------------------------------------
sed -e "s/<ACCOUNT_ID>/$AWS_ACCOUNT_ID/g" -e "s/<REGION>/$AWS_REGION/g" \
  deploy/task-definition.json > /tmp/task-definition.json

aws ecs register-task-definition \
  --cli-input-json file:///tmp/task-definition.json \
  --region "$AWS_REGION" \
  --query 'taskDefinition.taskDefinitionArn' --output text

# ---------------------------------------------------------------------------
# Cluster — idempotent.
# ---------------------------------------------------------------------------
aws ecs create-cluster --cluster-name harvey --region "$AWS_REGION" >/dev/null
echo "cluster: harvey"

# ---------------------------------------------------------------------------
# Network lookup — default VPC + first public subnet + default SG.
# ---------------------------------------------------------------------------
DEFAULT_VPC=$(aws ec2 describe-vpcs --filters "Name=isDefault,Values=true" \
  --query 'Vpcs[0].VpcId' --output text --region "$AWS_REGION")
SUBNET_ID=$(aws ec2 describe-subnets --filters "Name=vpc-id,Values=$DEFAULT_VPC" \
  --query 'Subnets[0].SubnetId' --output text --region "$AWS_REGION")
DEFAULT_SG=$(aws ec2 describe-security-groups \
  --filters "Name=vpc-id,Values=$DEFAULT_VPC" "Name=group-name,Values=default" \
  --query 'SecurityGroups[0].GroupId' --output text --region "$AWS_REGION")
echo "VPC=$DEFAULT_VPC  SUBNET=$SUBNET_ID  SG=$DEFAULT_SG"

# ---------------------------------------------------------------------------
# Service — one task, Fargate, public IP ON so the agent can reach
# LiveKit/OpenAI/Deepgram/ElevenLabs.
# ---------------------------------------------------------------------------
if aws ecs describe-services --cluster harvey --services harvey-agent \
    --region "$AWS_REGION" --query 'services[0].status' --output text 2>/dev/null | grep -q ACTIVE; then
  echo "service already exists — forcing a new deployment to pick up latest image"
  aws ecs update-service --cluster harvey --service harvey-agent \
    --force-new-deployment --region "$AWS_REGION" >/dev/null
else
  aws ecs create-service \
    --cluster harvey \
    --service-name harvey-agent \
    --task-definition harvey-agent \
    --desired-count 1 \
    --launch-type FARGATE \
    --platform-version 1.4.0 \
    --network-configuration "awsvpcConfiguration={subnets=[$SUBNET_ID],securityGroups=[$DEFAULT_SG],assignPublicIp=ENABLED}" \
    --region "$AWS_REGION" >/dev/null
  echo "service created"
fi

echo ""
echo "==========================================================="
echo "Deployed. Tailing logs. Wait ~60s for 'registered worker'."
echo "Press Ctrl+C when you see it."
echo "==========================================================="
sleep 20
aws logs tail /ecs/harvey-agent --follow --region "$AWS_REGION"
