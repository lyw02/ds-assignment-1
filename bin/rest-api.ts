#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { RestAPIAssignmentStack } from "../lib/rest-api-stack";
import { AuthAppStack } from '../lib/auth-app-stack';

const app = new cdk.App();
new AuthAppStack(app, 'AuthAPIStack', {
  stackName: "AuthAPIStack",
  env: { region: "eu-west-1" },
});
new RestAPIAssignmentStack(app, "RestAPIAssignmentStack", {
  stackName: "RestAPIAssignmentStack",
  env: { region: "eu-west-1" },
});
