#!/bin/sh
node server.js &
sleep 2
node bot.js &
while true; do sleep 3600; done
