var markerConfig = require('../markers/config');
var markerSelector = require('../markers');
var canvasPointFeature = require('../leaflet/canvasPointFeature');
var markers = markerConfig.defaults;

var geoJsonLayer, markerLayer;
var map, huc, datastore, mapModule;


module.exports.init = function(config) {
  mapModule = config.map;
  map = config.map.getLeaflet();
  datastore = config.datastore;
  huc = config.huc;

  markerLayer = new L.CanvasGeojsonLayer({
    /*onMouseOver : function(features) {
      markerSelector.hover(features);
      updateMouse(markerLayer._container, markerLayer.intersectList);
    },
    onMouseOut : function(features) {
      markerSelector.nohover(features);
      updateMouse(markerLayer._container, markerLayer.intersectList);
    },*/
    onClick : onFeaturesClicked
  });

  markerLayer.addTo(map);
  markerSelector.init(markerLayer);
};

module.exports.add = function(points) {
  var showNoDemand = $('#showNoDemand').is(':checked');
  datastore.clearFeatures();

  if( !showNoDemand ) {
    tmp = [];
    for( var i = points.length-1; i >= 0; i-- ) {
      if( points[i].properties.allocations && points[i].properties.allocations.length > 0 ) {

        var demand = points[i].properties.allocations[0].demand;
        if( demand !== 0 ) tmp.push(points[i]);
      }
    }
    points = tmp;
  }

  markerLayer.features = [];
  points.forEach(function(point){
    markerLayer.addFeature(canvasPointFeature(point));
  });
  markerLayer.render();

  currentPoints = points;
  huc.render(points);
};

function updateMouse(container, features) {
  if( features.length > 0 ) {
    container.style.cursor = 'pointer';
  } else {
    container.style.cursor = 'move';
  }
}

function onFeaturesClicked(features) {
  var html = '';

  markerSelector.select(features);

  for( var i = 0; i < features.length; i++ ) {
    var p = features[i].properties;

    html += mapModule.legend.stamp({
      application_number : p.application_number,
      date : getDate(p.allocations[0].date),
      allocation : p.allocations[0].allocation,
      demand : p.allocations[0].demand,
      ratio : p.allocations[0].ratio !== null ? (p.allocations[0].ratio*100).toFixed(2) : '100',
      water_right_type : p._rendered_as,
      priority_date : getDate(p.priority_date)
    });
  }

  $('#info-result').html(html);
  $('#info').animate({
    scrollTop: $('.info-box').height()
  }, 300);
}

function getDate(d) {
  if( d === undefined || d === null) return 'Unknown';
  if( typeof d === 'string' ) return d;
  return d.toDateString();
}

module.exports.clearLayer = function() {
  //if( geoJsonLayer ) map.removeLayer(geoJsonLayer);
  markerLayer.features = [];
  markerLayer.render();
};
