# dwrat-app
Water Right Allocations for California

## Develop
To develop the standalone dwrat-app, run the following commands.  [NodeJS, NPM](http://nodejs.org) and [Bower](http://bower.io) are required.

One time, init dev environment.  Run on first install or after git pull.
```
npm run init-dev

```

Note that you may also need to run a separate
```javascript
npr install -g grunt-cli
```
Nick had success with the main body of these install instructions at least once, but on another occasion had to separately install
grunt-cli for the following commands to work.

To develop, run:
```
// starts local web server, defaults to: localhost:8080
npm start

// watch filesystem and browserify changes to ./lib
npm dev
```

## Build
Create new dist dir

```
npm build
```

Test out the build
```
npm run start-dist
```

## Deploying and Using the Server
Documentation on deploying the server can be best found in the [documentation section](./docs/index.md).
A table of contents is also included below.

* [Setting Up the Core Server](./setting_up_server.md)
* [Adding Data to the Public Directory](./adding_public_directory.md)
* [System Requirements and Maintenance](system_requirements.md)
