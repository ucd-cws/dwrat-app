L.PolyMarker = L.CircleMarker.extend({

  initialize: function (latlng, options) {
    L.Circle.prototype.initialize.call(this, latlng, null, options);
    this._radius = this.options.radius;
    this._sides = this.options.sides ? this.options.sides : 6;
    this._rotate = this.options.rotate ? this.options.rotate : 0;
  },


  getPathString: function () {
    var p = this._point;
    if (this._checkIfEmpty()) {
      return '';
    }

    if (L.Browser.svg) {
      return this.polygon(p.x, p.y, this._radius, this._sides, this._rotate);
    } else {
      console.error("PolyMarker not using svg!!!");
    }
  },

  polygon : function(x, y, radius, sides, startAngle) {
    if (sides < 3) return;
    var a = ((Math.PI * 2)/sides);
    var r = startAngle * (Math.PI / 180);

    // think you need to adjust by x, y
    var p = "M";
    for (var i = 0; i < sides; i++) {
       p += (x+(radius*Math.cos(a*i-r)))+","+(y+(radius*Math.sin(a*i-r)))+" ";
    }
    p +=" z";
    return p;
  }
});

L.polyMarker = function (latlng, options) {
  return new L.PolyMarker(latlng, options);
};

L.Icon.Canvas = L.Icon.extend({
    options: {
        iconSize: new L.Point(20, 20), // Have to be supplied
        className: 'leaflet-canvas-icon'
    },

    createIcon: function () {
        var e = document.createElement('canvas');
        this._setIconStyles(e, 'icon');

        e.width = this.options.radius * 2;
        e.height = this.options.radius * 2;
        e.style.width = (this.options.radius * 2)+'px';
        e.style.height = (this.options.radius * 2)+'px';

        this.draw(e.getContext('2d'));

        return e;
    },

    createShadow: function () {
        return null;
    },


    draw: function(ctx) {
      ctx.clearRect(0, 0, this.options.radius*2, this.options.radius*2);

      ctx.beginPath();
      ctx.strokeStyle = this.options.color;
      ctx.arc(this.options.radius, this.options.radius, this.options.radius-1, 0, 2*Math.PI, false);

      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(1,1);
      ctx.lineTo((this.options.radius*2) - 1, (this.options.radius*2) - 1);
      ctx.stroke();
    }
});

L.noDemandIcon = function(latlng, options) {
  var marker = new L.Marker(latlng, {
      icon: new L.Icon.Canvas(options)
  });

  marker.setStyle = function(options) {
    var o = this.options.icon.options;

    $.extend(true, o, options);
    if( !this._icon ) return;
     
    var ctx = this._icon.getContext('2d');

    ctx.clearRect(0, 0, o.radius*2, o.radius*2);

    ctx.beginPath();
    ctx.strokeStyle = o.color;
    ctx.arc(o.radius, o.radius, o.radius-1, 0, 2*Math.PI);

    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(1,1);
    ctx.lineTo((o.radius*2) - 1, (o.radius*2) - 1);
    ctx.stroke();
  }


  return marker;
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

    var radius = this.config.radius;
    var sides = this.config.sides != null ? this.config.sides : 6;
    var rotate = this.config.rotate ? this.config.rotate : 0;
    var x = w / 2;
    var y = h / 2;

    this.drawPolygon(ctx, x, y, radius, sides, rotate);
  }

  this.drawPolygon = function(ctx, x, y, radius, sides, startAngle) {
    var a = ((Math.PI * 2)/sides);
    var r = startAngle * (Math.PI / 180);

    var rgb = hexToRgb(this.config.fillColor);


    var fillStyle = hexToRgb(this.config.fillColor);
    fillStyle.push(this.config.fillOpacity);
    ctx.fillStyle = 'rgba('+fillStyle.join(',')+')';

    ctx.strokeStyle = this.config.color;

    // think you need to adjust by x, y
    ctx.beginPath();

    // draw circle
    if ( sides < 3 ) {
      ctx.arc(x, y, radius, 0, 2*Math.PI);
    } else {
      var tx, ty;
      for (var i = 0; i < sides; i++) {
        tx = x + (radius * Math.cos(a*i-r));
        ty = y + (radius * Math.sin(a*i-r));

        if( i == 0 ) ctx.moveTo(tx, ty);
        else ctx.lineTo(tx, ty);
      }
      ctx.lineTo(x + (radius * Math.cos(-1 * r)), y + (radius * Math.sin(-1 * r)));
    }

    if( !this.config.noFill ) ctx.fill();
    ctx.stroke();


    if( this.config.strikethrough ) {
      ctx.beginPath();
      ctx.moveTo(1,1);
      ctx.lineTo((x*2) - 1, (y*2) - 1);
      ctx.stroke();
    }

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
