var markerConfig = require('../markers/config');
var IconRenderer = require('../markers/iconRenderer');
var markers = markerConfig.defaults;


module.exports = function(point) {

  var type = point.properties.riparian ? 'riparian' : 'application';
  var allocation = 'unallocated';

  for( var i = 0; i < point.properties.allocations.length; i++ ) {
    if( point.properties.allocations[i].allocation > 0 ) allocation = 'allocated';
  }

  var options = $.extend(true, {}, markers[type][allocation]);

  if( point.properties.allocations && point.properties.allocations.length > 0 ) {

    var demand = point.properties.allocations[0].demand;
    allocation = point.properties.allocations[0].allocation;

    if( demand === 0 ) {

      $.extend(true, options, markers.noDemand);
      point.properties.noDemand = true;

    } else {
      markerConfig.percentDemand(options, allocation / demand);

      var size = Math.sqrt(demand) * 3;
      if( size > 50 ) size = 50;
      if( size < 7 ) size = 7;

      options.height = size*2;
      options.width = size*2;
    }
  }

  var marker;
  var d = 1971;
  try {
    if( typeof point.properties.priority_date === 'string' ) {
      d = point.properties.priority_date ? parseInt(point.properties.priority_date.replace(/-.*/,'')) : 2000;
    } else if ( typeof point.properties.priority_date === 'object') {
      d = point.properties.priority_date.getYear()+1900;
    }
  } catch(e) {
    d = 1971;
  }



  if( point.properties.riparian ) {
    point.properties._rendered_as = 'Riparian';
    options.sides = 0;
    //marker = L.dwratMarker(latlng, options);
  } else if ( d < 1914 ) {
    point.properties._rendered_as = 'Pre-1914 Appropriative';
    options.sides = 3;
    options.rotate = 90;
    //marker = L.dwratMarker(latlng, options);
  } else {
    point.properties._rendered_as = 'Post-1914 Appropriative';
    //marker = L.dwratMarker(latlng, options);
  }

  point.properties._render = options;

  return {
      geojson : point,
      size : options.width/2,
      render : render
  };
};

function render(ctx, xyPoints, map) {
  IconRenderer(ctx, this.geojson.properties._render, xyPoints);
}
