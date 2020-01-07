provider "aws" {
  region = "${var.aws_region}"
  version = "~>2.0"
}

terraform {
  required_version = ">= 0.12.0"
}


resource "aws_iam_role" "iam_for_lambda" {
  name = "iam_for_lambda"

  assume_role_policy = <<EOF
{
     "Version": "2012-10-17",
     "Statement": [
      {
        "Action": "sts:AssumeRole",
        "Principal": {
          "Service": "lambda.amazonaws.com"
        },
        "Effect": "Allow",
        "Sid": ""
     }
    ]
}
EOF
}

resource "aws_lambda_function" "smugmug_lambda" {
  filename      = "lambda_smugmug.zip"
  function_name = "lambda_smugmug"
  role          = "${aws_iam_role.iam_for_lambda.arn}"
  handler       = "smugapinoauth.handler"

  # The filebase64sha256() function is available in Terraform 0.11.12 and later
  # For Terraform 0.11.11 and earlier, use the base64sha256() function and the file() function:
  # source_code_hash = "${base64sha256(file("lambda_function_payload.zip"))}"
  source_code_hash = "${filebase64sha256("lambda_smugmug.zip")}"

  runtime = "nodejs8.10"
}


resource "aws_api_gateway_rest_api" "SmugmugAPI" {
  name        = "SmugmugAPI"
  description = "API for Smugmug"
}

resource "aws_api_gateway_resource" "SmugmugResource" {
  rest_api_id = "${aws_api_gateway_rest_api.SmugmugAPI.id}"
  parent_id   = "${aws_api_gateway_rest_api.SmugmugAPI.root_resource_id}"
  path_part   = "{proxy+}"
}

resource "aws_api_gateway_method" "SmugMethod" {
  rest_api_id   = "${aws_api_gateway_rest_api.SmugmugAPI.id}"
  resource_id   = "${aws_api_gateway_resource.SmugmugResource.id}"
  http_method   = "ANY"
  authorization = "NONE"
}

resource "aws_api_gateway_method_settings" "SmugMethodSettings" {
  rest_api_id = "${aws_api_gateway_rest_api.SmugmugAPI.id}"
  stage_name  = "${aws_api_gateway_stage.SmugStage.stage_name}"
  #method_path = "${aws_api_gateway_resource.SmugmugResource.path_part}/${aws_api_gateway_method.SmugMethod.http_method}"
  method_path = "*/*"

  settings {
    data_trace_enabled = false
    throttling_rate_limit = 1000
    metrics_enabled = false
    logging_level   = "OFF"
    unauthorized_cache_control_header_strategy = "SUCCEED_WITHOUT_RESPONSE_HEADER"
    require_authorization_for_cache_control = true
    caching_enabled = false
  }
}

resource "aws_api_gateway_stage" "SmugStage" {
  stage_name    = "prod"
  rest_api_id   = "${aws_api_gateway_rest_api.SmugmugAPI.id}"
  deployment_id = "${aws_api_gateway_deployment.SmugDeployment.id}"
}


resource "aws_api_gateway_integration" "SmugmugIntegration" {
  rest_api_id = "${aws_api_gateway_rest_api.SmugmugAPI.id}"
  resource_id = "${aws_api_gateway_resource.SmugmugResource.id}"
  http_method = "${aws_api_gateway_method.SmugMethod.http_method}"
  type        = "AWS_PROXY"
  integration_http_method = "POST"
  uri         = "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/${aws_lambda_function.smugmug_lambda.arn}/invocations"
}


resource "aws_lambda_permission" "smugmug_lambda_permission" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = "${aws_lambda_function.smugmug_lambda.function_name}"
  principal     = "apigateway.amazonaws.com"

  # More: http://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-control-access-using-iam-policies-to-invoke-api.html
  source_arn = "arn:aws:execute-api:${var.aws_region}:${var.accountId}:${aws_api_gateway_rest_api.SmugmugAPI.id}/*/${aws_api_gateway_method.SmugMethod.http_method}/${aws_api_gateway_resource.SmugmugResource.path}"
}

resource "aws_api_gateway_deployment" "SmugDeployment" {
  depends_on = ["aws_api_gateway_integration.SmugmugIntegration"]

  rest_api_id = "${aws_api_gateway_rest_api.SmugmugAPI.id}"
  stage_name  = "smugmug"
}
