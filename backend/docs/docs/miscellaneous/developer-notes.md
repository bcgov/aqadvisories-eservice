---
permalink: /docs/developer-notes/
---

# Developer Notes

## Automated Testing

Test framework is created with and follows [Jasmine 2.6](https://jasmine.github.io/2.6/node.html) convention. To launch test, run `npm test`. To debug test scripts in IDE such as WebStorm, create a Node.js run/debug config, set _cwd_ to project root and script to _/node_modules/jasmine/bin/jasmine.js_.

Jenkins CI runs tests as part of the build, therefore all test scripts should be able to run unattended, headless, quickly and depend only on local resources.

### Writing Test Specs

Thanks to [supertest](https://github.com/visionmedia/supertest) and LoopBack's [memory database connector](https://loopback.io/doc/en/lb3/Memory-connector.html), test specs can be written to cover nearly end-to-end request processing workflow (only _sendMail_ and _sendSMS_ need to be mocked). This allows test specs to anchor onto business requirements rather than program units such as functions or files, resulting in regression tests that are more resilient to code refactoring.
Whenever possible, a test spec should be written to

- start at a processing phase as early as possible. For example, to test a REST end point, start with the HTTP user request.
- assert outcome of a processing phase as late and down below as possible - the HTTP response body/code, the database record created, for example.
- avoid asserting middleware function input/output to facilitate code refactoring.
- mock email/sms sending function (implemented by default). Inspect the input of the function, or at least assert the function has been called.

## Code Coverage

After running `npm test`, Istanbul code coverage report is generated in git ignored folder _/coverage_. _/coverage/lcov-report/index.html_ is the report entry point.
