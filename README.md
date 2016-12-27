![david-dm](https://david-dm.org/zkiiito/node-sbrick-controller.svg)

# SBrick Controller
Control your [Lego](https://lego.com) [SBrick](https://www.sbrick.com/) creations from the browser, using your keyboard!

## Requirements
A device with [node.js](https://nodejs.org/)  and a Bluetooth 4.x adapter, which is supported by [noble](https://github.com/sandeepmistry/noble#prerequisites).

## Installation
```
git clone git@github.com:zkiiito/node-sbrick-controller.git
cd node-sbrick-controller
npm install
npm start
```
then, open your browser at http://localhost:8000/

## Project status
Working from the web UI:
* scan for SBricks
* connect/disconnect
* channel control (drive with keyboard keys)
* temperature & voltage real time chart
* display video stream

Still under development:
* overall security: to put it on an raspberry PI, and control your creation from anywhere, it needs some :)
