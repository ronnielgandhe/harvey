import os

import pytest

from eval_retrieval import run

pytestmark = pytest.mark.skipif(not os.getenv("OPENAI_API_KEY"), reason="needs OPENAI_API_KEY for embeddings")


def test_routed_retrieval_hit_rate():
    result = run("routed")
    assert result["top1"] >= int(0.75 * result["n"]), result["rows"]
