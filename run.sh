#!/bin/bash
# Kill any lingering ngrok/expo processes
pkill -f ngrok 2>/dev/null
pkill -f expo 2>/dev/null
sleep 1

script -q -c "npx expo start --tunnel --clear --port 8084" /dev/null | tee studentlink.log
