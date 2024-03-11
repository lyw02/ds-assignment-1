#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { RestAPIAssignmentStack } from "../lib/rest-api-stack";

const app = new cdk.App();
new RestAPIAssignmentStack(app, "RestAPIAssignmentStack", {
  stackName: "RestAPIAssignmentStack",
  env: { region: "eu-west-1" },
});
