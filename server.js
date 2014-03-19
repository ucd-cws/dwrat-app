var express = require('express');
var app = express();
app.use(express.static('public'));



app.listen(3001);
console.log('running on localhost:3001');
