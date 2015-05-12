var IconRenderer = function(ctx, config) {

  var sides = config.sides != null ? config.sides : 6;
  var rotate = config.rotate ? config.rotate : 0;
  var x = config.width / 2;
  var y = config.height / 2;

  var a = ((Math.PI * 2) / config.sides);
  var r = rotate * (Math.PI / 180);

  var radius = (config.width / 2) - 1;

  var fillStyle = hexToRgb(config.fillColor);
  fillStyle.push(config.fillOpacity);
  ctx.fillStyle = 'rgba('+fillStyle.join(',')+')';

  ctx.strokeStyle = config.color;

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

      if( i == 0 ) ctx.moveTo(tx, ty);
      else ctx.lineTo(tx, ty);
    }
    ctx.lineTo(x + (radius * Math.cos(-1 * r)), y + (radius * Math.sin(-1 * r)));

  }

  if( !config.noFill ) ctx.fill();
  ctx.stroke();

  if( config.strikethrough ) {
    ctx.beginPath();
    ctx.moveTo(1,1);
    ctx.lineTo((x*2) - 1, (y*2) - 1);
    ctx.stroke();
  }
}

var DroughtIcon = function(config) {
  this.config = config;
  this.ele = document.createElement('canvas');


  this.redraw = function() {
    var w = config.height || 32;
    var h = config.width || 32;

    this.ele.height = h;
    this.ele.width = w;

    var ctx = this.ele.getContext("2d");
    ctx.clearRect(0, 0, w, h);

    IconRenderer(ctx, config);
  }

  this.redraw();
}

function hexToRgb(hex) {
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16)
    ] : [0,0,0];
}
