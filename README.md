# ZeNMOS

Automated testing application for AMWA NMOS IS-04. The source in this folder is for an [Electron](https://electronjs.org/) application that tests aspects of implementation of the [AMWA NMOS specifications](https://amwa-tv.github.io/nmos/), focussing on [IS-04 discovery and registration](https://amwa-tv.github.io/nmos-discovery-registration/) in the first instance. The design is highly modular, so the project can also be used as a set of [Node-RED](https://nodered.org/) modules that can be assembled to be NMOS components in their own right.

This is early release code at version v0.0.1. Please see the [enhancements](#enhancements) section for details of the features that are and are not yet supported.

# Installation

## Prerequisites

If not already installed, install [Node.JS LTS](https://nodejs.org/) for your platform on an Internet connected computer with `git` installed.

## Getting the source

Download the source by cloning the github project:

    git clone https://github.com/Streampunk/zenmos.git
    cd zenmos

Install the projects dependencies using `npm` - this is time consuming - beverage may be required:

    npm install

## Running in dev mode

To run the application in development mode:

    npm run dev

In this mode, tweaks can be made to the underlying software and the debugger tag is available to interact directly with the software.

See the [building](#building) section for details of creating an installable application.

## Using directly with Node-RED

As well as being an Electron Application, ZeNMOS is also a Node-RED module. To use the Node-RED nodes, firstly install Node-RED as a global application for your platform.

    npm install -g node-red

Create a link target to the zenmos module in the zenmos folder:

    npm link

Run Node-RED to create a user folder in your home directory `~/.node-red`:

    node-red

_Ctrl-C_ to stop the server. Now change directory to the user's Node-RED folder and link in the zenmos module, e.g. on Mac or Linux:

    cd ~/.node-red
    npm link zenmos
    node-red

Connect to Node-RED using a browser at http://localhost:1880 and scroll down to find the ZeNMOS nodes at the bottom of the list. The nodes are self-documenting.

# Building

Create operating-system-specific install packages of ZeNMOS using _Electron Builder_. Currently tested platforms are Windows and Mac OSX.

    npm run-script build

Go and make a cup of your favorite beverage.

In the `build` folder, an install package will be created. For Windows `Zenmos Setup 0.0.1.exe` and for Mac `Zenmos-0.0.1.dmg`.

Install and run the packages in the normal way for your platform.

# Enhancements

It was not possible to develop all requested features in the time available. The following is a list of known debits that the authors will continue to work on:

* Websocket support.
* Generating random metadata to test all corners of the schemas.
* Peer-to-peer support in the Node API.
* Storing and retrieving tests results in an external database.
* Running scripted tests.
* Running in _man-in-the-middle_ mode, offering a client registration API, logging and testing messages and passing on requests as a if a node to a 3rd party registration API.
* Support for the deprecated v1.0 subscription API.
* General testing of node failure and heartbeats.
* Checking integration with other OSS implementations.
* Confirm support on Linux platforms.

The following is a list of extensions that the authors would like to make subject to time and resource

* A standalone registration and query service using the ZeNMOS components, resulting in the deprecation of [Streampunk's NMOS ledger](https://githib.com/Streampunk/ledger).
* A standalone test node that is easy to set into various test states.
* Support for HTTPS.
* Support for the RQL query language in the Query API.
* Adding support for IS-05 and IS-06 as appropriate.
* Linking to external and federated data stores.
* A graphical dashboard combined with performance testing.
* Integrating alongside the Sony-contributed _mininet_ scalability testing framework.
* Cross-referencing SDP parameters with those declared in the API.
* Cloud-hosted testing environments.
* Pre-built binaries for download.

Pull requests and issues will be resolved when the developers have sufficient time available. If you are interested in sponsoring the development of this software or supporting its ongoing maintenance, please contact [Streampunk Media](https://www.streampunk.media) (furnace@streampunk.media).

# License

This software is released under the Apache 2.0 license. Copyright 2018 Streampunk Media Ltd.
