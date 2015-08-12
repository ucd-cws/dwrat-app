L.dwratMarker = function (latlng, options) {
  var marker = new L.Marker(latlng, {
      icon: new L.Icon.Canvas(options),
      iconSize: new L.Point(options.width, options.height),
  });

  marker.setStyle = function(options) {
    var o = this.options.icon.options;

    $.extend(true, o, options);
    if( !this._icon ) return;

    var ctx = this._icon.getContext('2d');
    ctx.clearRect(0, 0, o.width, o.height);

    IconRenderer(ctx, o);
  }

  return marker;
};
