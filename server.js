var express = require('express');
var app = express();
app.use(express.static('public'));



app.listen(3000);
console.log('running on localhost:3000/test.html');
