var util = require('./utils');

module.exports = function(ctx, config, xyPoints) {

  var sides = config.sides !== null ? config.sides : 6;
  var rotate = config.rotate ? config.rotate : 0;
  var x, y;
  if( xyPoints ) {
    x = xyPoints.x;
    y = xyPoints.y;
  } else {
    x = config.width / 2;
    y = config.height / 2;
  }

  var a = ((Math.PI * 2) / config.sides);
  var r = rotate * (Math.PI / 180);

  var radius = (config.width / 2) - 1;

  var fillStyle = util.hexToRgb(config.fillColor);
  fillStyle.push(config.fillOpacity);
  ctx.fillStyle = 'rgba('+fillStyle.join(',')+')';

  var color = config.highlight ? 'yellow' : config.color;
  if( config.hover ) color = 'orange';
  ctx.strokeStyle = color;

  // think you need to adjust by x, y
  ctx.beginPath();

  // draw circle
  if ( sides < 3 ) {

    ctx.arc(x, y, radius, 0, 2*Math.PI);

  } else {

    var tx, ty, i;
    for (i = 0; i < config.sides; i++) {
      tx = x + (radius * Math.cos(a*i-r));
      ty = y + (radius * Math.sin(a*i-r));

      if( i === 0 ) ctx.moveTo(tx, ty);
      else ctx.lineTo(tx, ty);
    }

    ctx.lineTo(x + (radius * Math.cos(-1 * r)), y + (radius * Math.sin(-1 * r)));
    ctx.closePath();
  }

  if( !config.noFill ) ctx.fill();
  ctx.stroke();

  if( config.strikethrough ) {
    ctx.beginPath();
    if( xyPoints ) {
      var w2 = config.width / 2, h2 = config.height / 2;
      ctx.moveTo(x-w2, y-h2);
      ctx.lineTo(x+w2 - 1, y+h2 - 1);
    } else {
      ctx.moveTo(1, 1);
      ctx.lineTo(config.width - 1, config.height - 1);
    }

    ctx.stroke();
    ctx.closePath();
  }
};
