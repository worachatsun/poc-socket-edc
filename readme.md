## Run the server and client

### Install dependencies
```pnpm install```

### Start the server:

```
cd ../socketio-server
node server.js
```


In another terminal, start the EDC device client:
```
cd ../edc-device
node device.js
```

### Test the system

To send a task to the EDC device, use cURL or Postman:
```
curl -X POST http://localhost:3000/request \
     -H "Content-Type: application/json" \
     -d '{"action": "process_payment", "amount": 50.00}'
```
To check the device status:

```
curl http://localhost:3000/device
```