var HUC = (function(){

  var map;
  var layers = [];
  var pointsByHuc = {};
  var urlPrefix = 'http://watershed.ice.ucdavis.edu/vizsource/rest?view=get_huc_by_id(\'';
  var urlPostix = '\')&tq=SELECT *';

  var hucCache = {};
  var requested = {};

  var showing = true;
  var currentPoints = null;

  function init(m) {
    map = m;

    $('#renderHucAvg').on('change', function(){
      showing = $(this).is(':checked');
      onVisibilityUpdate(showing);
    });
  }

  function onVisibilityUpdate() {
    if( !showing ) {
      clear();
    } else if( currentPoints !== null ){
      render(currentPoints);
    }
  }

  function clear() {
    // clear all layers
    for( var i = 0; i < layers.length; i++ ) {
      map.removeLayer(layers[i]);
    }
    layers = [];
    pointsByHuc = {};
  }

  function render(points) {
    currentPoints = points;
    if( !showing ) return;


    clear();

    // organize points by huc
    var huc;
    for( var i = 0; i < currentPoints.length; i++ ) {
      // TODO: did quinn change this?
      huc = points[i].properties['HUC-12'] || points[i].properties.huc_12;

      if( pointsByHuc[huc] ) pointsByHuc[huc].push(points[i]);
      else pointsByHuc[huc] = [points[i]];
    }

    // request missing huc geojson and/or render huc
    for( var huc in pointsByHuc ) {
      if( huc === undefined || huc === 'undefined' ) debugger;

      if( hucCache[huc] ) renderHuc(huc);
      else if( !requested[huc] ) request(huc);
    }
  }

  function request(hucId) {
    requested[hucId] = 1;

    var query = new google.visualization.Query(urlPrefix+hucId+urlPostix);
    query.setTimeout(60*5); // 5 min timeout
    query.send(function(response){
      if (response.isError() ) return alert('Error retrieving HUC 12 data for id "'+hucId+'"');

      var data = response.getDataTable();

      if( data.getNumberOfRows() == 0 ) {
        debugger;
        return alert('Error: invalid HUC 12 id "'+hucId+"'");
      }

      var geometry = JSON.parse(data.getValue(0, 0));
      var geojsonFeature = {
        "type": "Feature",
        "properties": {
            "id": hucId,
        },
        "geometry": geometry
      };
      hucCache[hucId] = geojsonFeature;

      renderHuc(hucId);
    });
  }

  function renderHuc(id) {
    if( !showing ) return;

    var points = pointsByHuc[id];

    // calculate percent demand
    var percentDemands = [], feature;
    for( var i = 0; i < points.length; i++ ) {
      feature = points[i];

      if( feature.properties.allocations && feature.properties.allocations.length > 0 ) {
        var demand = feature.properties.allocations[0].demand;
        var allocation = feature.properties.allocations[0].allocation;

        if( demand != 0 ) {
          percentDemands.push(allocation / demand);
        }
      }
    }

    // calc average
    var avgPrecentDemand = -1;
    var tmp = 0;
    for( var i = 0; i < percentDemands.length; i++ ) {
      tmp += percentDemands[i];
    }
    if( percentDemands.length > 0 ) avgPrecentDemand = tmp / percentDemands.length;

    var layer = L.geoJson(
      hucCache[id],
      {
        style: function(feature) {
          return renderPercentDemandHuc(avgPrecentDemand);
        }
      }
    ).addTo(map);

    layers.push(layer);
  }

  return {
    init : init,
    render : render
  }


})();
