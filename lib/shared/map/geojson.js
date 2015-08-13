var markerConfig = require('../markers/config');
var markerSelector = require('../markers');
var markers = markerConfig.defaults;

var geoJsonLayer;
var map, huc, datastore, mapModule;

module.exports.init = function(config) {
  mapModule = config.map;
  map = config.map.getLeaflet();
  datastore = config.datastore;
  huc = config.huc;
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

  geoJsonLayer = L.geoJson(points,{
    pointToLayer: function (feature, latlng) {
      var type = feature.properties.riparian ? 'riparian' : 'application';
      var allocation = 'unallocated';

      for( var i = 0; i < feature.properties.allocations.length; i++ ) {
        if( feature.properties.allocations[i].allocation > 0 ) allocation = 'allocated';
      }


      var options = $.extend(true, {}, markers[type][allocation]);

      if( feature.properties.allocations && feature.properties.allocations.length > 0 ) {

        var demand = feature.properties.allocations[0].demand;
        var allocation = feature.properties.allocations[0].allocation;

        if( demand === 0 ) {

          $.extend(true, options, markers.noDemand);
          feature.properties.noDemand = true;

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
        if( typeof feature.properties.priority_date === 'string' ) {
          d = feature.properties.priority_date ? parseInt(feature.properties.priority_date.replace(/-.*/,'')) : 2000;
        } else if ( typeof feature.properties.priority_date === 'object') {
          d = feature.properties.priority_date.getYear()+1900;
        }
      } catch(e) {
        d = 1971;
      }



      if( feature.properties.riparian ) {
        feature.properties._rendered_as = 'Riparian';
        options.sides = 0;
        marker = L.dwratMarker(latlng, options);
      } else if ( d < 1914 ) {
        feature.properties._rendered_as = 'Pre-1914 Appropriative';
        options.sides = 3;
        options.rotate = 90;
        marker = L.dwratMarker(latlng, options);
      } else {
        feature.properties._rendered_as = 'Post-1914 Appropriative';
        marker = L.dwratMarker(latlng, options);
      }

      datastore.addFeature({
        feature : feature,
        marker  : marker
      });
      return marker;
    }
  }).addTo(map);

  geoJsonLayer.on('click', function(e) {
    $('.select-text').remove();
    $('#info').show();
    var props = e.layer.feature.properties;

    markerSelector.select(e.layer);

    var ll = e.layer.feature.geometry.coordinates;

    var t, html = '';
    var allData = datastore.getFeatures();
    for( var i = 0; i < allData.length; i++ ) {
      t = allData[i].feature.geometry.coordinates;
      if( ll[0].toFixed(4) == t[0].toFixed(4) && ll[1].toFixed(4) == t[1].toFixed(4) ) {
        var p = allData[i].feature.properties;

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
    }


    $('#info-result').html(html);
    $('#info').animate({
      scrollTop: $('.info-box').height()
    }, 300);
  });

  currentPoints = points;
  huc.render(points);
};

function getDate(d) {
  if( d === undefined || d === null) return 'Unknown';
  if( typeof d === 'string' ) return d;
  return d.toDateString();
}

module.exports.clearLayer = function() {
  if( geoJsonLayer ) map.removeLayer(geoJsonLayer);
};
