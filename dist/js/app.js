(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.DWRAT = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var data = {
  all : [],
  noDemand : [],
  features : []
};

module.exports.set = function(points) {
  data.all = points;

  tmp = [];
  for( var i = points.length-1; i >= 0; i-- ) {
    if( points[i].properties.allocations && points[i].properties.allocations.length > 0 ) {

      var demand = points[i].properties.allocations[0].demand;
      if( demand !== 0 ) tmp.push(points[i]);
    }
  }
  data.noDemand = tmp;
};

module.exports.get = function(noDemand) {
  if( noDemand ) return data.noDemand;
  return data.all;
};

module.exports.clearFeatures = function(){
  data.features = [];
};

module.exports.addFeature = function(feature) {
  data.features.push(feature);
};

module.exports.getFeatures = function() {
  return data.features;
};

},{}],2:[function(require,module,exports){
var process = require('./process');

var QUERY_SIZE = 1000;
var queryRoot = 'http://gispublic.waterboards.ca.gov/arcgis/rest/services/Water_Rights/Points_of_Diversion/MapServer/0/query';
var queryAppIdVar = 'WBGIS.Points_of_Diversion.APPL_ID';
var queryLatitude = 'WBGIS.Points_of_Diversion.LATITUDE';
var queryLongitude = 'WBGIS.Points_of_Diversion.LONGITUDE';
var queryOutfields =  [queryAppIdVar, queryLongitude, queryLatitude].join(',');

var queryParams = {
  f : 'json',
  where : '',
  returnGeometry : 'false',
  spatialRel : 'esriSpatialRelIntersects',
  geometry : '',
  geometryType : 'esriGeometryEnvelope',
  inSR : '102100',
  outFields : queryOutfields,
  outSR : '102100'
};

var HEADERS = {
    application_number : {
        required : true,
        type : 'string'
    },
    demand_date : {
        required : true,
        type : 'date-string'
    },
    watershed : {
        required : false,
        type : 'string'
    },
    season : {
        required : false,
        type : 'boolean',
    },
    'huc-12' : {
        required : false,
        type : 'boolean'
    },
    water_right_type : {
        required : false,
        type : 'string'
    },
    priority_date : {
        required : true,
        type : 'date-string'
    },
    riparian : {
        required : false,
        type : 'boolean'
    },
    pre1914 : {
        required : false,
        type : 'boolean'
    },
    demand : {
        required : true,
        type : 'float'
    },
    allocation : {
        required : true,
        type : 'float'
    }
};

var locations = {}, map, datastore;

function createGeoJson(data, attrMap, callback) {
    // first locate data
    $('#file-locate').html('Locating data...');

    var ids = [], key;
    var col = getAttrCol('application_number', data, attrMap);
    for( var i = 1; i < data.length; i++ ) {
        var id = data[i][col];
        if( !locations[id] ) ids.push(data[i][col]);
    }

    locateData(0, ids, function(){

        $('#file-locate').html('Creating data...');

        var iMap = {};
        for( key in attrMap ) iMap[attrMap[key]] = key;

        var geoJson = [];
        for( var i = 1; i < data.length; i++ ) {
            if( !locations[data[i][col]] ) continue;

            var p = {
                type : 'Feature',
                geometry : $.extend({}, true, locations[data[i][col]]),
                properties : {}
            };

            for( var j = 0; j < data[0].length; j++ ) {
                key = data[0][j];
                if( iMap[key] ) key = iMap[key];
                p.properties[key] = (HEADERS[key] && HEADERS[key].type == 'float') ? parseFloat(data[i][j]) : data[i][j];
            }

            p.properties.allocations = [{
                season : true,
                allocation : p.properties.allocation,
                demand : p.properties.demand,
                forecast : false,
                date : p.properties.demand_date,
                public_health_bind : false,
                wrbind : false,
                ratio : (p.properties.demand > 0) ? (p.properties.allocation / p.properties.demand) : 0
            }];

            geoJson.push(p);
        }

        map.clearGeojsonLayer();
        datastore.set(geoJson);
        map.geojson.add(geoJson);

        $('#file-locate').html('');
        callback();
    });
}

function getAttrCol(attr, data, map) {
    if( map[attr] ) return data[0].indexOf(map[attr]);
    return data[0].indexOf(attr);
}

function locateData(index, ids, callback) {

    if( index+1 >= ids.length ) {
        callback();
    } else {
        var idGroup = [];
        
        var i = 0;
        for( i = index; i < index+QUERY_SIZE; i++ ) {
            if( ids.length == i ) break;
            idGroup.push(ids[i]);
        }
        index += QUERY_SIZE;
        console.log(index);

        var params = $.extend(true, {}, queryParams);
        params.where = queryAppIdVar + ' in (\'' + idGroup.join('\',\'') + '\')';

        $.post(queryRoot, params,function(resp){
          var f, i;
          for( i = 0; i < resp.features.length; i++ ) {
            f = resp.features[i].attributes;
            locations[f[queryAppIdVar]] = {
              type: 'Point',
              coordinates: [f[queryLongitude], f[queryLatitude]]
            };
          }

          $('#file-locate').html('Locating data '+((index/ids.length).toFixed(2)*100)+'%...');
          locateData(index, ids, callback);
        },'json');
    }
}



var file = {
  HEADERS : HEADERS,
  init : function(options){
    map = options.map;
    datastore = options.datastore;
    options.file = this;

    require('./setup')(process);
    process.init(options);
  },
  createGeoJson : createGeoJson,
  process : process
};


module.exports = file;

},{"./process":4,"./setup":5}],3:[function(require,module,exports){
module.exports = function(type, contents, callback) {
    if( type == 'xlsx' ) {
        try {
            function onXlsxComplete(wb){
                selectWorksheet(wb.SheetNames, function(sheetName){
                    var csv = XLSX.utils.sheet_to_csv(wb.Sheets[sheetName]);
                    $.csv.toArrays(csv, {}, function(err, data){
                        if( err ) return callback(err);
                        callback(null, data);
                    });
                });
            }

            var worker = new Worker('bower_components/js-xlsx/xlsxworker.js');
            worker.onmessage = function(e) {
                switch(e.data.t) {
                    case 'ready': break;
                    case 'e': console.error(e.data.d); break;
                    case 'xlsx': onXlsxComplete(JSON.parse(e.data.d)); break;
                }
            };
            worker.postMessage({d:contents,b:true});

        } catch(e) {
            callback(e);
        }

    } else if( info.ext == 'xls' ) {
        try {
            function onXlsComplete(wb){
                selectWorksheet(wb.SheetNames, function(sheetName){
                    var csv = XLS.utils.sheet_to_csv(wb.Sheets[sheetName]);
                    $.csv.toArrays(csv, {}, function(err, data){
                        if( err ) return callback(err);
                        callback(null, data);
                    });
                });
            }

            var worker = new Worker('bower_components/js-xls/xlsworker.js');
            worker.onmessage = function(e) {
                switch(e.data.t) {
                    case 'ready': break;
                    case 'e': console.error(e.data.d); break;
                    case 'xlsx': onXlsComplete(JSON.parse(e.data.d)); break;
                }
            };
            worker.postMessage({d:contents,b:true});

        } catch(e) {
            debugger;
            this.onComplete(e, null, info, 1, 1, arr, callback);
        }
    } else {
        try {
            var options = {};
            //if( info.parser == 'csv-tab' ) options.separator = '\t';

            $.csv.toArrays(contents, options, function(err, data){
                if( err ) return callback(err);
                callback(null, data);
            }.bind(this));
        } catch(e) {
            debugger;
            this.onComplete(e, null, info, 1, 1, arr, callback);
        }
    }
}

},{}],4:[function(require,module,exports){
var parse = require('./parse');

// names DWR keeps using though we discussed otherwise...
var previousAttrMap = {
  'application_number' : 'AppID',
  'demand_date' : 'Pull Date',
  'priority_date': 'File Date'
};

var file, map, filename = '', huc;

module.exports.init = function(options) {
  file = options.file;
  map = options.map;
  huc = options.huc;
};

// process a file
module.exports.run = function(e) {
  e.stopPropagation();
  e.preventDefault();
  var files = e.dataTransfer ? e.dataTransfer.files : e.target.files; // FileList object.

  if( files.length > 0 ) {
    $('#file-locate').html('Loading file...');
    filename = files[0].name;
    read(files[0]);
  }
};

module.exports.setFilename = function(name) {
  filename = name;
};

function importContents(type, contents, callback) {
  parse(type, contents, onFileParsed);
}
module.exports.importContents = importContents;

function onFileParsed(err, data) {
  $('#file-locate').html('');
  matchCols(data, function(colMap){

    // now locate data and create
    file.createGeoJson(data, colMap, updateUiPostImport);
  });
}
module.exports.onFileParsed = onFileParsed;

function updateUiPostImport() {
  $('#date-selection').hide();
  $('#file-selection').html('<a class="btn btn-link" id="remove-file-btn">'+filename+' <i class="fa fa-times"></i></a>');

  $('#remove-file-btn').on('click',function(){
    map.geojson.clearLayer();
    huc.clear();
    $('#date-selection').show();
    $('#file-selection').html('');
  });

  $('#file-input').val('');
  $('#toast').hide();
}

function read(raw) {
    _resetUI();

    var type = 'text';

    var reader = new FileReader();
    reader.onload = function(e) {
        importContents(type, e.target.result);
    };

    if( raw.name.match(/.*\.xlsx?$/) ) {
        type = raw.name.replace(/.*\./,'');
        reader.readAsBinaryString(raw);
    } else {
        reader.readAsText(raw);
    }
}

function matchCols(data, callback) {
    if( data.length == 0 ) return alert('Your file is empty');

    var matches = [];
    var requiredMismatches = [];
    var mapped = previousAttrMap;

    var flatten = [];
    for( var i = 0; i < data[0].length; i++ ) {
      flatten.push(data[0][i].toLowerCase());
    }

    for( var key in file.HEADERS ) {
        if( previousAttrMap[key] && flatten.indexOf(previousAttrMap[key].toLowerCase()) > -1 ) {
            matches.push(key);
        } else if( flatten.indexOf(key.toLowerCase()) == -1 && file.HEADERS[key].required ) {
            requiredMismatches.push(key);
        } else if( flatten.indexOf(key.toLowerCase()) > -1 ) {
          if( data[0].indexOf(key) > -1 ) {
            matches.push(key);
          } else { // the case differs, add it to the attribute map
            var index = flatten.indexOf(key.toLowerCase());
            previousAttrMap[key] = data[0][index];
          }
        }
    }

    $('#file-modal').modal('hide');

    if( requiredMismatches.length == 0 ) return callback(previousAttrMap);

    // make sure modal is showing
    $('#match-modal').modal('show');

    var table = '<table class="table">';
    for( var i = 0; i < requiredMismatches.length; i++ ) {
        table += '<tr><td>'+requiredMismatches[i]+'</td><td>'+_createMatchSelector(requiredMismatches[i], data[0], matches)+'</td></tr>';
    }
    table += '</table>';

    $('#matchTable').html('<div style="margin-top:20px;font-weight:bold">Please match the following required columns to continue</div>'+table);
    $('.match-selector').on('change', function(){
        var key = $(this).attr('key');
        var val = $(this).val();

        if( val == '' || !val ) {
            delete mapped[key];
            requiredMismatches.push(key);
        } else {
            mapped[key] = val;
            var index = requiredMismatches.indexOf(key);
            if (index > -1) requiredMismatches.splice(index, 1);
        }


        if( requiredMismatches.length == 0 ) {
            $('#match-modal').modal('hide');
            $('#matchTable').html('');
            previousAttrMap = mapped;
            callback(mapped);
        }
    });
}


function _resetUI() {
    $('#matchTable').html('');
    $('#file-locate').html('');
}

function _createMatchSelector(key, arr, matches) {
    var select = '<select class="match-selector" key="'+key+'"><option></option>';

    for( var i = 0; i < arr.length; i++ ) {
        if( matches.indexOf(arr[i]) > -1 ) continue;
        select += '<option value="'+arr[i]+'">'+arr[i]+'</option>';
    }
    return select + '</select>';
}

function selectWorksheet(sheetNames, callback) {
    console.log(sheetNames);

    if( sheetNames.length == 1 ) callback(sheetNames[0]);

    // add UI interaction here
    callback(sheetNames[0]);
}

},{"./parse":3}],5:[function(require,module,exports){
module.exports = function(process) {
  $('#close-popup').on('click', function(){
    $('#info').removeClass('fadeInDown').addClass('slideOutRight');

    //legend.select(null);
    setTimeout(function(){
      $('#info').hide().addClass('fadeInDown').removeClass('slideOutRight');
    }, 800);
  });

  // file upload stuff
  $('#file-modal').modal({show:false});
  $('#file-input').on('change', function(e) {
    process.run(e);
  });
  $('#upload-btn').on('click', function(){
    $('#file-modal').modal('show');
  });

  $('body').on('dragover', function(e){
    e.preventDefault();
    e.stopPropagation();

    $('#upload-drop-message').show();
    $('#wrapper').css('opacity', 0.3);
  }).on('dragleave', function(e){
    e.preventDefault();
    e.stopPropagation();

    $('#upload-drop-message').hide();
    $('#wrapper').css('opacity',1);
  }).on('drop', function(e){
    $('#upload-drop-message').hide();
    $('#wrapper').css('opacity',1);

    process.run(e.originalEvent);
    $('#file-modal').modal('show');

  });
};

},{}],6:[function(require,module,exports){
var markerConfig = require('../markers/config');

var map;
var layers = [];
var pointsByHuc = {};
var urlPrefix = 'http://watershed.ice.ucdavis.edu/vizsource/rest?view=get_huc_by_id(\'';
var urlPostix = '\')&tq=SELECT *';

var lookupUrl = 'http://atlas.cws.ucdavis.edu/arcgis/rest/services/Watersheds/MapServer/0/query?';
var lookupParams = {
    where : '',
    geometryType : 'esriGeometryEnvelope',
    spatialRel : 'esriSpatialRelIntersects',
    outFields : '*',
    returnGeometry : 'true',
    outSR : '4326',
    f : 'pjson'
};

var hucCache = {};
var requested = {};

var showing = true;
var currentPoints = null;

function init(options) {
  map = options.map.getLeaflet();

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
    huc = points[i].properties['huc-12'] || points[i].properties.huc_12;

    if( pointsByHuc[huc] ) pointsByHuc[huc].push(points[i]);
    else pointsByHuc[huc] = [points[i]];
  }

  // request missing huc geojson and/or render huc
  for( var huc in pointsByHuc ) {
    if( huc === undefined || huc === 'undefined' ) {
      debugger;
      continue;
    }

    if( hucCache[huc] ) renderHuc(huc);
    else if( !requested[huc] ) request(huc);
  }
}

function request(hucId) {
  requested[hucId] = 1;

  var params = $.extend(true, {}, lookupParams);
  params.where = 'HUC_12 = \''+hucId+'\'';
  var paramText = [];
  for( var key in params ) {
    paramText.push(key+'='+encodeURIComponent(params[key]));
  }
  $.get(lookupUrl+paramText.join('&'), onLookupResponse);

  /*var query = new google.visualization.Query(urlPrefix+hucId+urlPostix);
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
  });*/
}

function onLookupResponse(resp) {
  if( typeof resp === 'string' ) {
    resp = JSON.parse(resp);
  }

  if( resp.features && resp.features.length > 0 ) {
    var feature = resp.features[0];


    var geojson = {
      'type': 'Feature',
      'properties': feature.attributes,
      'geometry': {
        type : 'Polygon',
        coordinates : feature.geometry.rings
      }
    };

    geojson.properties.id = geojson.properties.HUC_12;

    hucCache[geojson.properties.id] = geojson;
    if( !geojson.properties.id ) {
      console.log('bad response looking up HUC:');
      console.log(feature);
    }

    renderHuc(geojson.properties.id);
  }
}

function renderHuc(id) {
  if( !showing ) return;

  var points = pointsByHuc[id];

  if( !points ) {
    alert('Unabled to lookup points for HUC: '+id);
    return;
  }

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
        return markerConfig.percentDemandHuc(avgPrecentDemand);
      }
    }
  ).addTo(map);

  layers.push(layer);
}

function getCache() {
  return hucCache;
}

module.exports = {
  init : init,
  render : render,
  clear : clear,
  getCache : getCache
};

},{"../markers/config":17}],7:[function(require,module,exports){
require('./leaflet'); // import custom markers to leaflet namespace (global)
var map = require('./map');
var huc = require('./huc');
var file = require('./file');
var directory = require('./library');
var datastore = require('./datastore');


var map, geoJsonLayer;
var wmsLayers = [];
var allData = [];

// should be filled or empty;
var renderDemand = 'empty';
var currentPoints = null;
var lastRespPoints = null;

$(document).on('ready', function(){
  resize();
  init();
});

$(window)
  .on('resize', resize);

function init() {
  var config = {
    datastore : datastore,
    map : map,
    huc : huc
  };

  map.init(config);
  huc.init(config);
  file.init(config);
  directory.init(config);

  // quickly loads /testdata/SacRiver.csv for testing
  // require('./test')(file);
}

function resize() {
  var h = window.innerHeight;
  var w = window.innerWidth;
  if( h === null ) h = $(window).height();
  if( w === null ) w = $(window).width();

  $('#map').height(h).width(w);
  $('#info').css('max-height', (h-85)+'px');
}

module.exports = {
  map : map,
  huc : huc,
  file : file,
  directory : directory,
  ds : datastore
};

},{"./datastore":1,"./file":2,"./huc":6,"./leaflet":11,"./library":14,"./map":16}],8:[function(require,module,exports){
var IconRenderer = require('../markers/iconRenderer');

L.Icon.Canvas = L.Icon.extend({
    options: {
        iconSize: new L.Point(20, 20), // Have to be supplied
        className: 'leaflet-canvas-icon'
    },

    createIcon: function () {
        var e = document.createElement('canvas');
        this._setIconStyles(e, 'icon');

        e.width = this.options.width;
        e.height = this.options.height;

        e.style.marginTop = (-1*this.options.width/2)+'px';
        e.style.marginLeft = (-1*this.options.height/2)+'px';

        e.style.width = this.options.width+'px';
        e.style.height =this.options.height+'px';

        this.draw(e.getContext('2d'));

        return e;
    },

    createShadow: function () {
        return null;
    },


    draw: function(ctx) {
      IconRenderer(ctx, this.options);
    }
});

},{"../markers/iconRenderer":19}],9:[function(require,module,exports){
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

},{"../markers/config":17,"../markers/iconRenderer":19}],10:[function(require,module,exports){
var IconRenderer = require('../markers/iconRenderer');

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
  };

  return marker;
};

},{"../markers/iconRenderer":19}],11:[function(require,module,exports){
require('./canvas');
require('./dwrat');
require('../../../node_modules/leaflet-canvas-geojson/src/layer.js');

},{"../../../node_modules/leaflet-canvas-geojson/src/layer.js":22,"./canvas":8,"./dwrat":10}],12:[function(require,module,exports){
(function (global){
var DroughtIcon = require('../markers/droughtIcon');
var markerConfig = require('../markers/config');
var markerTemplate = require('./template');
var markers = markerConfig.defaults;
var map, datastore;

global.settings = {
  renderDemand : 'empty'
};

module.exports.init = function(config) {
  map = config.map;
  datastore = config.datastore;

  var demandSteps = [0, 1, 50, 100, 250];

  var options = $.extend(true, {}, markers.riparian.unallocated);
  options.sides = 0;
  var icon = new DroughtIcon(options);
  $('#legend-riparian').append($(icon.ele));


  options = $.extend(true, {}, markers.application.unallocated);
  options.sides = 3;
  options.rotate = 90;
  icon = new DroughtIcon(options);
  $('#legend-pre-appropriative').append($(icon.ele));

  icon = new DroughtIcon(markers.application.unallocated);
  $('#legend-post-appropriative').append($(icon.ele));

  var table = '<table style="text-align:center"><tr style="vertical-align: bottom">';
  var icons = [];
  for( var i = 0; i < demandSteps.length; i++ ) {
    table += '<td style="padding:4px"><div id="legend-demand-'+i+'"></div><div>'+
              (demandSteps[i] == 1 ? '<' : '') +
              (demandSteps[i] == 250 ? '>' : '') +
              demandSteps[i]+'</div></td>';


    if( demandSteps[i] === 0 ) {
      options = $.extend(true, {}, markers.application.unallocated);
      options = $.extend(true, options, markers.noDemand);
    } else {
      options = $.extend(true, {}, markers.application.unallocated);

      var size = Math.sqrt(demandSteps[i]) * 3;
      if( size > 50 ) size = 50;
      if( size < 7 ) size = 7;

      options.height = (size*2)+2;
      options.width = (size*2)+2;
    }

    icons.push(new DroughtIcon(options));
  }
  $('#legend-demand').html(table+'</tr></table>');

  for( i = 0; i < icons.length; i++ ) {
    $('#legend-demand-'+i).append($(icons[i].ele));
  }

  this.redrawPDemandLegend();

  // init toggle button

  $('#legendToggle').on('click', function(){
    if( this.hasAttribute('showing') ) {
      this.removeAttribute('showing');
      $('#legend').hide('slow');
      this.innerHTML = '<i class="fa fa-arrow-right"></i>';

    } else {
      this.setAttribute('showing', '');
      $('#legend').show('slow');
      this.innerHTML = '<i class="fa fa-arrow-down"></i>';
    }
  });

  $('#renderTypeFilled').on('click', onRenderTypeChange);
  $('#renderTypeEmpty').on('click', onRenderTypeChange);

  $('#showNoDemand').on('click', function(){
    map.geojson.clearLayer();
    var noDemand = !$(this).is(':checked');
    map.geojson.add(datastore.get(noDemand));
  });
};

function redrawPDemandLegend() {
  var percentSteps = [0, 25, 50, 75, 100], i;

  var table = '<table style="text-align:center"><tr style="vertical-align: bottom">';
  var icons = [];
	for( i = 0; i < percentSteps.length; i++ ) {
		table += '<td style="padding:8px"><div id="legend-precent-of-demand-'+i+'"></div><div>'+
					percentSteps[i]+'%</div></td>';

		var options = $.extend(true, {}, markers.application.unallocated);

    markerConfig.percentDemand(options, percentSteps[i] / 100);

		icons.push(new DroughtIcon(options));
	}
	$('#legend-precent-of-demand').html(table+'</tr></table>');

	for( i = 0; i < icons.length; i++ ) {
		$('#legend-precent-of-demand-'+i).append($(icons[i].ele));
	}
};
module.exports.redrawPDemandLegend = redrawPDemandLegend;

function onRenderTypeChange() {
  var settings = global.settings;
  var isFilledChecked = $('#renderTypeFilled').is(':checked');
  var newVal = isFilledChecked ? 'filled' : 'empty';

  if( settings.renderDemand == newVal ) return;
  settings.renderDemand = newVal;

  // render legend
  redrawPDemandLegend();

  if( !currentPoints ) return;

  map.geojson.clearLayer();
  var noDemand = !$(this).is(':checked');
  map.geojson.add(datastore.get(noDemand));
}

module.exports.stamp = function(data) {
  var template = markerTemplate;
  for( var key in data ) template = template.replace('{{'+key+'}}', data[key]);
  return template;
};

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"../markers/config":17,"../markers/droughtIcon":18,"./template":13}],13:[function(require,module,exports){
module.exports = 
  '<div class="spacer"></div>'+
  '<h3>Water Right/Claim #: {{application_number}}</h3>'+
  '<div style="margin:15px">'+
    '<b>For:</b> {{date}}<br />'+
    '<b>Allocation:</b> {{allocation}} [Ac-ft/day]<br />'+
    '<b>Demand:</b> {{demand}} [Ac-ft/day]'+
    '<br /><b>Percent of Demand: </b>{{ratio}}%<br />'+
    '<div class="well well-sm" style="margin-top:5px">'+
    '{{water_right_type}}<br />'+
    '<b>Priority Date:</b> {{priority_date}}'+
    '</div>'+
  '</div>';

},{}],14:[function(require,module,exports){
var files = [];

var root = 'https://docs.google.com/spreadsheets/d/1ACi7P0pOy-JRjtw6HribQphhEOZ-0-CkQ_mqnyCfJcI/gviz/tq';
var popup, body, file, map, toast;

function init(config) {
  file = config.file;
  map = config.map;

  var query = new google.visualization.Query(root);
  query.send(onInitLoad);

  popup = $('#directory-modal').modal({show: false});
  body = $('#directory-modal-body');

  $('#directory-btn').on('click', function(){
    popup.modal('show');
  });

  toast = $('<div style="display:none;position:fixed;left:10px; bottom: 50px" class="animated fadeInUp" id="toast"><div class="alert alert-success"><i class="fa fa-spinner fa-spin"></i> Loading File...</div></div>');
  $('body').append(toast);
}

function onInitLoad(resp) {
  if (resp.isError()) {
    alert('Error in loading public directory listing: ' + response.getMessage() + ' ' + response.getDetailedMessage());
    return;
  }

  var data = resp.getDataTable();
  var rowLen = data.getNumberOfRows();
  var colLen = data.getNumberOfColumns();

  var table = '<h4>Select File to Load</h4><table class="table">';
  table += '<tr><th>Filename</th><th>Start Date</th><th>End Date</th><td></td></tr>';
  for( var i = 0; i < rowLen; i++ ) {
    var file = {};
    for( var j = 0; j < colLen; j++ ) {
      file[data.getColumnLabel(j)] = data.getValue(i, j);
    }

    table += fileToRow(file, i);

    files.push(file);
  }

  body
    .html(table+'</table>')
    .find('a[index]')
    .on('click', function(){
      var file = files[parseInt($(this).attr('index'))];
      load(file.Region+' '+getDates(file), file.ID);
      popup.modal('hide');
    });
}

function getDates(file) {
  if( !file['Start Date'] || !file['End Date'] ) return '';

  var txt = '(';
  txt += file['Start Date'] ? toDate(file['Start Date']) : '?';
  txt += ' - ';
  txt += file['End Date'] ? toDate(file['End Date']) : '?';
  return txt + ')';

}

function load(name, id) {
  toast.show();

  var query = new google.visualization.Query('https://docs.google.com/spreadsheets/d/'+id+'/gviz/tq');
  query.send(function(resp){
    if (resp.isError()) {
      toast.hide();
      alert('Error in loading public sheet: ' + response.getMessage() + ' ' + response.getDetailedMessage());
      return;
    }

    var data = resp.getDataTable();
    var rowLen = data.getNumberOfRows();
    var colLen = data.getNumberOfColumns();
    var csv = [[]];


    for( var i = 0; i < colLen; i++ ) {
      csv[0].push(data.getColumnLabel(i));
    }

    for( var i = 0; i < rowLen; i++ ) {
      var row = [];
      for( var j = 0; j < colLen; j++ ) {
        row.push(data.getValue(i, j));
      }
      csv.push(row);
    }

    file.process.setFilename(name);
    file.process.onFileParsed(null, csv);
  });
}

function fileToRow(file, index) {
  return '<tr>' +
    '<td><a class="btn btn-link" index="'+index+'"><i class="fa fa-download"></i> '+file.Region+'</a></td>'+
    '<td>'+getDate(file['Start Date'])+'</td>'+
    '<td>'+getDate(file['End Date'])+'</td>'+
    '<td><a class="btn btn-link" href="https://docs.google.com/spreadsheets/d/'+file.ID+'" target="_blank"><i class="fa fa-table"></i></a></td>'+
  '</tr>';
}

function getDate(d) {
  if( !d ) return '?';
  return toDate(d);
}

function toDate(d) {
  return (d.getYear()+1900)+'-'+(d.getMonth()+1)+'-'+d.getDate();
}

module.exports = {
  init : init
};

},{}],15:[function(require,module,exports){
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

},{"../leaflet/canvasPointFeature":9,"../markers":20,"../markers/config":17}],16:[function(require,module,exports){
var map;
var baseMaps = {};
var overlayMaps = {};

var geojson = require('./geojson');
var geojsonLayer = {};

var currentPoints = null;
var currentGeojson = null;

module.exports.legend = require('../legend');
module.exports.geojson = require('./geojson');



module.exports.init = function(options) {
  map = L.map('map',{trackResize:true});

  // add an OpenStreetMap tile layer
  L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);

  var wms1 = L.tileLayer.wms("https://mapsengine.google.com/15542600734275549444-11853667273131550346-4/wms/?version=1.3.0", {
      layers: '15542600734275549444-08112974690991164587-4',
      format: 'image/png',
      transparent: true,
      attribution: "",
      bounds : L.latLngBounds(
        L.latLng(42.00943198804058, -114.1307597213407),
        L.latLng(32.53426345367493, -124.40971171678298)
      )
  }).addTo(map);

  /*var wms2 = L.tileLayer.wms("https://mapsengine.google.com/15542600734275549444-11853667273131550346-4/wms/?version=1.3.0", {
      layers: '15542600734275549444-16143158689603361093-4',
      format: 'image/png',
      transparent: true,
      attribution: "",
      bounds : L.latLngBounds(
        L.latLng(42.00943198804058, -114.1307597213407),
        L.latLng(32.53426345367493, -124.40971171678298)
      )
  });*/
  var wms2 = L.tileLayer.wms("http://atlas.cws.ucdavis.edu/arcgis/services/Watersheds/MapServer/WMSServer", {
      layers: '0',
      format: 'image/png',
      transparent: true,
      attribution: "",
      bounds : L.latLngBounds(
        L.latLng(43.353144, -113.058443),
        L.latLng(32.044528, -124.718638)
      )
  });

  baseMaps = {};
  overlayMaps = {
    'Watersheds': wms1,
    'HUC 12': wms2
  };

  L.control.layers(baseMaps, overlayMaps, {position: 'bottomleft'}).addTo(map);

  options.map = this;
  geojson.init(options);
  this.legend.init(options);
};

module.exports.clearGeojsonLayer = function() {
  geojson.clearLayer();
};
module.exports.getLeaflet = function() {
  return map;
};

},{"../legend":12,"./geojson":15}],17:[function(require,module,exports){
(function (global){
var markers = {
  riparian : {
    allocated : {
      fillColor   : "#2525C9",
      color       : "#333333",
      weight      : 1,
      opacity     : 1,
      fillOpacity : 0.3,
			sides : 3,
			rotate : 90,
      width: 20,
      height: 20
    },
    unallocated : {
      fillColor   : "#ffffff",
      color       : "#333333",
      weight      : 1,
      opacity     : 1,
      fillOpacity : 0.3,
			sides : 3,
			rotate : 90,
      width: 20,
      height: 20
    }
  },
  application : {
    allocated : {
      fillColor   : "#2525C9",
      color       : "#333333",
      weight      : 1,
      opacity     : 1,
      fillOpacity : 0.3,
      sides       : 4,
      rotate      : 45,
      width: 20,
      height: 20
    },
    unallocated : {
      fillColor   : "#ffffff",
      color       : "#333333",
      weight      : 1,
      opacity     : 1,
      fillOpacity : 0.3,
      sides       : 4,
      rotate      : 45,
      width: 20,
      height: 20
    }
  },
  noDemand : {
    noFill : true,
    //sides : 0,
    color : "#333333",
    strikethrough : true,
    radius : 5,
    height : 12,
    width : 12
  }
};
module.exports.defaults = markers;

module.exports.percentDemand = function(options, percent, noDemand) {
  if( noDemand ) {
     $.extend(true, options, markers.noDemand);
     return;
  }

  var o;

  if( global.settings.renderDemand == 'filled' ) {

    if( percent <= 0 ) {
      options.fillColor = '#333';
      options.fillOpacity = 0.3;
    } else {
      o = percent;
      if( o > 1 ) o = 1;
      options.fillOpacity = o;
      options.fillColor = '#0000ff';
    }

  } else {

    if( percent >= 1 ) {
      options.fillColor = '#333';
      options.fillOpacity = 0.3;
    } else {
      o = 1 - percent;
      if( o > 1 ) o = 1;
      if( o < 0 ) o = 0;

      options.fillOpacity = o;
      options.fillColor = '#ff0000';
    }

  }
  //options.fillColor = '#'+getColor(allocation / demand);
};

module.exports.percentDemandHuc = function(percent) {
  if( percent == -1 ) {
     return {
       fillColor : '#ffffff',
       fillOpacity : 0.2,
       weight : 1,
       color: '#333333'
     };
  }


  if( global.settings.renderDemand == 'filled' ) {

    if( percent <= 0 ) {

      return {
        fillColor : '#333333',
        fillOpacity : 0.3,
        weight : 2,
        color: '#333333'
      };


    } else {
      var o = percent;
      if( o > 0.8 ) o = 0.8;

      return {
        fillColor : '#0000ff',
        fillOpacity : o,
        weight : 2,
        color: '#333333'
      };
    }

  } else {

    if( percent >= 1 ) {

      return {
        fillColor : '#333333',
        fillOpacity : 0.3,
        weight : 2,
        color: '#333333'
      };

    } else {
      var o = 1 - percent;
      if( o > 0.8 ) o = 0.8;
      if( o < 0 ) o = 0;

      return {
        fillColor : '#ff0000',
        fillOpacity : o,
        weight : 2,
        color: '#333333'
      };

    }

  }
  //options.fillColor = '#'+getColor(allocation / demand);
};

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}],18:[function(require,module,exports){
var IconRenderer = require('./iconRenderer');

module.exports = function(config) {
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
  };

  this.redraw();
};

},{"./iconRenderer":19}],19:[function(require,module,exports){
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

},{"./utils":21}],20:[function(require,module,exports){
var data = {
  selected : null,
  hovered : null
};
var layer;

module.exports.init = function(l) {
  layer = l;
};

module.exports.hover = function(markers) {
  update('hovered', 'hover', markers);
};

module.exports.nohover = function(markers) {
  if( !data.hovered ) return;

  for( var i = 0; i < markers.length; i++ ) {
    var index = data.hovered.indexOf(markers[i]);
    if( index > -1 ) data.hovered[index].properties._render.hover = false;
  }

  layer.render();
};

module.exports.select = function(markers) {
  update('selected', 'highlight', markers);
};

function update(array, property, markers) {
  if( data[array] !== null ) {
    data[array].forEach(function(marker){
      marker.properties._render[property] = false;
    });
  }

  if( markers ) {
    data[array] = markers;
    markers.forEach(function(marker){
      marker.properties._render[property] = true;
    });
  }

  if( layer ) {
    layer.render();
  }
}

},{}],21:[function(require,module,exports){
module.exports.hexToRgb = function(hex) {
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16)
    ] : [0,0,0];
};

module.exports.getColor = function(num) {
  if( num > 1 ) num = 1;
  if( num < 0 ) num = 0;

  var spread = Math.floor(510*num) - 255;

  if( spread < 0 ) return "ff00"+toHex(255+spread);
  else if( spread > 0 ) return toHex(255-spread)+"00ff";
  else return "ffff00";
};

module.exports.toHex = function(num) {
  num = num.toString(16);
  if( num.length == 1 ) num = "0"+num;
  return num;
};

},{}],22:[function(require,module,exports){
/**
  A Feature should have the following:

  feature = {
    visible : Boolean,
    size : Number, // points only, used for mouse interactions
    geojson : {}
    render : function(context, coordinatesInXY, map) {} // called in feature scope
  }

  geoXY and leaflet will be assigned
**/

L.CanvasGeojsonLayer = L.Class.extend({
  // show layer timing
  debug : false,

  // include events
  includes: [L.Mixin.Events],

  // list of geojson features to draw
  //   - these will draw in order
  features : [],

  // list of current features under the mouse
  intersectList : [],

  // used to calculate pixels moved from center
  lastCenterLL : null,

  // geometry helpers
  utils : require('./utils'),

  // initialize layer
  initialize: function (options) {
    // set options
    options = options || {};
    L.Util.setOptions(this, options);

    // move mouse event handlers to layer scope
    var mouseEvents = ['onMouseOver', 'onMouseMove', 'onMouseOut', 'onClick'];
    mouseEvents.forEach(function(e){
      if( !this.options[e] ) return;
      this[e] = this.options[e];
      delete this.options[e];
    }.bind(this));

    // set canvas and canvas context shortcuts
    this._canvas = this._createCanvas();
    this._ctx = this._canvas.getContext('2d');
  },

  _createCanvas: function() {
    var canvas = document.createElement('canvas');
    canvas.style.position = 'absolute';
    canvas.style.top = 0;
    canvas.style.left = 0;
    canvas.style.pointerEvents = "none";
    canvas.style.zIndex = this.options.zIndex || 0;
    var className = 'leaflet-tile-container leaflet-zoom-animated';
    canvas.setAttribute('class', className);
    return canvas;
  },

  onAdd: function (map) {
    this._map = map;

    // add container with the canvas to the tile pane
    // the container is moved in the oposite direction of the
    // map pane to keep the canvas always in (0, 0)
    //var tilePane = this._map._panes.tilePane;
    var tilePane = this._map._panes.markerPane;
    var _container = L.DomUtil.create('div', 'leaflet-layer');

    _container.appendChild(this._canvas);
    tilePane.appendChild(_container);

    this._container = _container;

    // hack: listen to predrag event launched by dragging to
    // set container in position (0, 0) in screen coordinates
    if (map.dragging.enabled()) {
      map.dragging._draggable.on('predrag', function() {
        var d = map.dragging._draggable;
        L.DomUtil.setPosition(this._canvas, { x: -d._newPos.x, y: -d._newPos.y });
      }, this);
    }

    map.on({
      'viewreset' : this._reset,
      'resize'    : this._reset,
      'move'      : this.render,
      'zoomstart' : this._startZoom,
      'zoomend'   : this._endZoom,
      'mousemove' : this._intersects,
      'click'     : this._intersects
    }, this);

    this._reset();

    if( this.zIndex !== undefined ) {
      this.setZIndex(this.zIndex);
    }
  },

  setZIndex : function(index) {
    this.zIndex = index;
    if( this._container ) {
      this._container.style.zIndex = index;
    }
  },

  _startZoom: function() {
    this._canvas.style.visibility = 'hidden';
    this.zooming = true;
  },

  _endZoom: function () {
    this._canvas.style.visibility = 'visible';
    this.zooming = false;
    setTimeout(this.render.bind(this), 50);
  },

  getCanvas: function() {
    return this._canvas;
  },

  draw: function() {
    this._reset();
  },

  onRemove: function (map) {
    this._container.parentNode.removeChild(this._container);
    map.off({
      'viewreset' : this._reset,
      'resize'    : this._reset,
      'move'      : this.render,
      'zoomstart' : this._startZoom,
      'zoomend'   : this._endZoom,
      'mousemove' : this._intersects,
      'click'     : this._intersects
    }, this);
  },

  addTo: function (map) {
    map.addLayer(this);
    return this;
  },

  _reset: function () {
    // reset actual canvas size
    var size = this._map.getSize();
    this._canvas.width = size.x;
    this._canvas.height = size.y;

    this.clearCache();

    this.render();
  },

  // clear each features cache
  clearCache : function() {
    // kill the feature point cache
    for( var i = 0; i < this.features.length; i++ ) {
      this.clearFeatureCache( this.features[i] );
    }
  },

  clearFeatureCache : function(feature) {
    if( !feature.cache ) return;
    feature.cache.geoXY = null;
  },

  // redraw all features.  This does not handle clearing the canvas or setting
  // the canvas correct position.  That is handled by render
  redraw: function(diff) {
    // objects should keep track of last bbox and zoom of map
    // if this hasn't changed the ll -> container pt is not needed
    var bounds = this._map.getBounds();
    var zoom = this._map.getZoom();

    if( this.debug ) t = new Date().getTime();

    for( var i = 0; i < this.features.length; i++ ) {
      this.redrawFeature(this.features[i], bounds, zoom, diff);
    }

    if( this.debug ) console.log('Render time: '+(new Date().getTime() - t)+'ms; avg: '+
      ((new Date().getTime() - t) / this.features.length)+'ms');
  },

  // redraw an individual feature
  redrawFeature : function(feature, bounds, zoom, diff) {
    //if( feature.geojson.properties.debug ) debugger;

    // ignore anything flagged as hidden
    // we do need to clear the cache in this case
    if( !feature.visible ) {
      this.clearFeatureCache(feature);
      return;
    }

    // now lets check cache to see if we need to reproject the
    // xy coordinates
    var reproject = true;
    if( feature.cache ) {
      if( feature.cache.zoom == zoom && feature.cache.geoXY ) {
        reproject = false;
      }
    }

    // actually project to xy if needed
    if( reproject ) {
      this._calcGeoXY(feature, zoom);
    }  // end reproject

    // if this was a simple pan event (a diff was provided) and we did not reproject
    // move the feature by diff x/y
    if( diff && !reproject ) {
      if( feature.geojson.geometry.type == 'Point' ) {

        feature.cache.geoXY.x += diff.x;
        feature.cache.geoXY.y += diff.y;

      } else if( feature.geojson.geometry.type == 'LineString' ) {

        this.utils.moveLine(feature.cache.geoXY, diff);

      } else if ( feature.geojson.geometry.type == 'Polygon' ) {
        this.utils.moveLine(feature.cache.geoXY, diff);
      } else if ( feature.geojson.geometry.type == 'MultiPolygon' ) {
        for( var i = 0; i < feature.cache.geoXY.length; i++ ) {
          this.utils.moveLine(feature.cache.geoXY[i], diff);
        }
      }
    }

    // ignore anything not in bounds
    if( feature.geojson.geometry.type == 'Point' ) {
      if( !bounds.contains(feature.latlng) ) {
        return;
      }
    } else if( feature.geojson.geometry.type == 'MultiPolygon' ) {

      // just make sure at least one polygon is within range
      var found = false;
      for( var i = 0; i < feature.bounds.length; i++ ) {
        if( bounds.contains(feature.bounds[i]) || bounds.intersects(feature.bounds[i]) ) {
          found = true;
          break;
        }
      }
      if( !found ) return;

    } else {
      if( !bounds.contains(feature.bounds) && !bounds.intersects(feature.bounds) ) {
        return;
      }
    }

    // call feature render function in feature scope; feature is passed as well
    feature.render.call(feature, this._ctx, feature.cache.geoXY, this._map, feature);
  },

  _calcGeoXY : function(feature, zoom) {
    // make sure we have a cache namespace and set the zoom level
    if( !feature.cache ) feature.cache = {};
    feature.cache.zoom = zoom;

    if( feature.geojson.geometry.type == 'Point' ) {

      feature.cache.geoXY = this._map.latLngToContainerPoint([
          feature.geojson.geometry.coordinates[1],
          feature.geojson.geometry.coordinates[0]
      ]);

      if( feature.size ) {
        feature.cache.geoXY[0] = feature.cache.geoXY[0] - feature.size / 2;
        feature.cache.geoXY[1] = feature.cache.geoXY[1] - feature.size / 2;
      }

    } else if( feature.geojson.geometry.type == 'LineString' ) {
      feature.cache.geoXY = this.utils.projectLine(feature.geojson.geometry.coordinates, this._map);

    } else if ( feature.geojson.geometry.type == 'Polygon' ) {
      feature.cache.geoXY = this.utils.projectLine(feature.geojson.geometry.coordinates[0], this._map);
    } else if ( feature.geojson.geometry.type == 'MultiPolygon' ) {
      feature.cache.geoXY = [];
      for( var i = 0; i < feature.geojson.geometry.coordinates.length; i++ ) {
        feature.cache.geoXY.push(this.utils.projectLine(feature.geojson.geometry.coordinates[i][0], this._map));
      }
    }

  },

  addFeatures : function(features) {
    for( var i = 0; i < this.features.length; i++ ) {
      this.addFeature(this.features[i]);
    }
  },

  addFeature : function(feature, bottom) {
    if( !feature.geojson ) return;
    if( !feature.geojson.geometry ) return;

    if( typeof feature.visible === 'undefined' ) feature.visible = true;
    feature.cache = null;

    if( feature.geojson.geometry.type == 'LineString' ) {
      feature.bounds = this.utils.calcBounds(feature.geojson.geometry.coordinates);

    } else if ( feature.geojson.geometry.type == 'Polygon' ) {
      // TODO: we only support outer rings out the moment, no inner rings.  Thus coordinates[0]
      feature.bounds = this.utils.calcBounds(feature.geojson.geometry.coordinates[0]);

    } else if ( feature.geojson.geometry.type == 'Point' ) {
      feature.latlng = L.latLng(feature.geojson.geometry.coordinates[1], feature.geojson.geometry.coordinates[0]);
    } else if ( feature.geojson.geometry.type == 'MultiPolygon' ) {
      feature.bounds = [];
      for( var i = 0; i < feature.geojson.geometry.coordinates.length; i++  ) {
        feature.bounds.push(this.utils.calcBounds(feature.geojson.geometry.coordinates[i][0]));
      }
    } else {
      console.log('GeoJSON feature type "'+feature.geojson.geometry.type+'" not supported.');
      console.log(feature.geojson);
      return;
    }

    if( bottom ) { // bottom or index
      if( typeof bottom === 'number') this.features.splice(bottom, 0, feature);
      else this.features.unshift(feature);
    } else {
      this.features.push(feature);
    }
  },

  addFeatureBottom : function(feature) {
    this.addFeature(feature, true);
  },

  // returns true if re-render required.  ie the feature was visible;
  removeFeature : function(feature) {
    var index = this.features.indexOf(feature);
    if( index == -1 ) return;

    this.splice(index, 1);

    if( this.feature.visible ) return true;
    return false;
  },

  // get layer feature via geojson object
  getFeatureForGeojson : function(geojson) {
    for( var i = 0; i < this.features.length; i++ ) {
      if( this.features[i].geojson == geojson ) return this.features[i];
    }

    return null;
  },

  render: function(e) {
    var t, diff
    if( this.debug ) t = new Date().getTime();

    var diff = null;
    if( e && e.type == 'move' ) {
      var center = this._map.getCenter();

      var pt = this._map.latLngToContainerPoint(center);
      if( this.lastCenterLL ) {
        var lastXy = this._map.latLngToContainerPoint(this.lastCenterLL);
        diff = {
          x : lastXy.x - pt.x,
          y : lastXy.y - pt.y
        }
      }

      this.lastCenterLL = center;
    }

    var topLeft = this._map.containerPointToLayerPoint([0, 0]);
    L.DomUtil.setPosition(this._canvas, topLeft);

    var canvas = this.getCanvas();
    var ctx = canvas.getContext('2d');

    // clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if( !this.zooming ) this.redraw(diff);

    if( this.debug ) {
      diff = new Date().getTime() - t;

      var c = 0;
      for( var i = 0; i < this.features.length; i++ ) {
        if( !this.features[i].cache.geoXY ) continue;
        if( Array.isArray(this.features[i].cache.geoXY) ) c += this.features[i].cache.geoXY.length;
      }

      console.log('Rendered '+c+' pts in '+diff+'ms');
    }
  },

  /*
    return list of all intersecting geometry regradless is currently visible

    pxRadius - is for lines and points only.  Basically how far off the line or
    or point a latlng can be and still be considered intersecting.  This is
    given in px as it is compensating for user intent with mouse click or touch.
    The point must lay inside to polygon for a match.
  */
  getAllIntersectingGeometry : function(latlng, pxRadius) {
    var mpp = this.utils.metersPerPx(latlng, this._map);
    var r = mpp * (pxRadius || 5); // 5 px radius buffer;

    var center = {
      type : 'Point',
      coordinates : [latlng.lng, latlng.lat]
    };
    var zoom = this._map.getZoom();
    var containerPoint = this._map.latLngToContainerPoint(latlng);

    var f;
    var intersects = [];

    for( var i = 0; i < this.features.length; i++ ) {
      f = this.features[i];

      if( !f.geojson.geometry ) continue;

      // check the bounding box for intersection first
      if( !this._isInBounds(feature, latlng) ) continue;

      // see if we need to recalc the x,y screen coordinate cache
      if( !f.cache ) this._calcGeoXY(f, zoom);
      else if( !f.cache.geoXY ) this._calcGeoXY(f, zoom);

      if( this.utils.geometryWithinRadius(f.geojson.geometry, f.cache.geoXY, center, containerPoint, r) ) {
        intersects.push(f);
      }
    }

    return intersects;
  },

  // returns true if in bounds or unknown
  _isInBounds : function(feature, latlng) {
    if( feature.bounds ) {
      if( Array.isArray(feature.bounds) ) {

        for( var i = 0; i < feature.bounds.length; i++ ) {
          if( feature.bounds[i].contains(latlng) ) return true;
        }

      } else if ( feature.bounds.contains(latlng) ) {
        return true;
      }

      return false;
    }
    return true;
  },

  // get the meters per px and a certain point;
  getMetersPerPx : function(latlng) {
    return this.utils.metersPerPx(latlng, this._map);
  },

  _intersects : function(e) {
    var t = new Date().getTime();
    var mpp = this.getMetersPerPx(e.latlng);
    var r = mpp * 5; // 5 px radius buffer;

    var center = {
      type : 'Point',
      coordinates : [e.latlng.lng, e.latlng.lat]
    };

    var f;
    var intersects = [];

    for( var i = 0; i < this.features.length; i++ ) {
      f = this.features[i];

      if( !f.visible ) continue;
      if( !f.geojson.geometry ) continue;
      if( !f.cache ) continue;
      if( !f.cache.geoXY ) continue;
      if( !this._isInBounds(f, e.latlng) ) continue;

      if( this.utils.geometryWithinRadius(f.geojson.geometry, f.cache.geoXY, center, e.containerPoint, f.size ? (f.size * mpp) : r) ) {
        intersects.push(f.geojson);
      }

    }

    if( e.type == 'click' && this.onClick ) {
      this.onClick(intersects);
      return;
    }

    var mouseover = [], mouseout = [], mousemove = [];

    var changed = false;
    for( var i = 0; i < intersects.length; i++ ) {
      if( this.intersectList.indexOf(intersects[i]) > -1 ) {
        mousemove.push(intersects[i]);
      } else {
        changed = true;
        mouseover.push(intersects[i]);
      }
    }

    for( var i = 0; i < this.intersectList.length; i++ ) {
      if( intersects.indexOf(this.intersectList[i]) == -1 ) {
        changed = true;
        mouseout.push(this.intersectList[i]);
      }
    }

    this.intersectList = intersects;

    if( this.onMouseOver && mouseover.length > 0 ) this.onMouseOver.call(this, mouseover, e);
    if( this.onMouseMove ) this.onMouseMove.call(this, mousemove, e); // always fire
    if( this.onMouseOut && mouseout.length > 0 ) this.onMouseOut.call(this, mouseout, e);

    if( this.debug ) console.log('intersects time: '+(new Date().getTime() - t)+'ms');

    if( changed ) this.render();
  }
});

},{"./utils":23}],23:[function(require,module,exports){
module.exports = {
  moveLine : function(coords, diff) {
    var i; len = coords.length;
    for( i = 0; i < len; i++ ) {
      coords[i].x += diff.x;
      coords[i].y += diff.y;
    }
  },

  projectLine : function(coords, map) {
    var xyLine = [];

    for( var i = 0; i < coords.length; i++ ) {
      xyLine.push(map.latLngToContainerPoint([
          coords[i][1], coords[i][0]
      ]));
    }

    return xyLine;
  },

  calcBounds : function(coords) {
    var xmin = coords[0][1];
    var xmax = coords[0][1];
    var ymin = coords[0][0];
    var ymax = coords[0][0];

    for( var i = 1; i < coords.length; i++ ) {
      if( xmin > coords[i][1] ) xmin = coords[i][1];
      if( xmax < coords[i][1] ) xmax = coords[i][1];

      if( ymin > coords[i][0] ) ymin = coords[i][0];
      if( ymax < coords[i][0] ) ymax = coords[i][0];
    }

    var southWest = L.latLng(xmin-.01, ymin-.01);
    var northEast = L.latLng(xmax+.01, ymax+.01);

    return L.latLngBounds(southWest, northEast);
  },

  geometryWithinRadius : function(geometry, xyPoints, center, xyPoint, radius) {
    if (geometry.type == 'Point') {
      return this.pointDistance(geometry, center) <= radius;
    } else if (geometry.type == 'LineString' ) {

      for( var i = 1; i < xyPoints.length; i++ ) {
        if( this.lineIntersectsCircle(xyPoints[i-1], xyPoints[i], xyPoint, 3) ) {
          return true;
        }
      }

      return false;
    } else if (geometry.type == 'Polygon' || geometry.type == 'MultiPolygon') {
      return this.pointInPolygon(center, geometry);
    }
  },

  // http://math.stackexchange.com/questions/275529/check-if-line-intersects-with-circles-perimeter
  // https://en.wikipedia.org/wiki/Distance_from_a_point_to_a_line
  // [lng x, lat, y]
  lineIntersectsCircle : function(lineP1, lineP2, point, radius) {
    var distance =
      Math.abs(
        ((lineP2.y - lineP1.y)*point.x) - ((lineP2.x - lineP1.x)*point.y) + (lineP2.x*lineP1.y) - (lineP2.y*lineP1.x)
      ) /
      Math.sqrt(
        Math.pow(lineP2.y - lineP1.y, 2) + Math.pow(lineP2.x - lineP1.x, 2)
      );
    return distance <= radius;
  },

  // http://wiki.openstreetmap.org/wiki/Zoom_levels
  // http://stackoverflow.com/questions/27545098/leaflet-calculating-meters-per-pixel-at-zoom-level
  metersPerPx : function(ll, map) {
    var pointC = map.latLngToContainerPoint(ll); // convert to containerpoint (pixels)
    var pointX = [pointC.x + 1, pointC.y]; // add one pixel to x

    // convert containerpoints to latlng's
    var latLngC = map.containerPointToLatLng(pointC);
    var latLngX = map.containerPointToLatLng(pointX);

    var distanceX = latLngC.distanceTo(latLngX); // calculate distance between c and x (latitude)
    return distanceX;
  },

  // from http://www.movable-type.co.uk/scripts/latlong.html
  pointDistance : function (pt1, pt2) {
    var lon1 = pt1.coordinates[0],
      lat1 = pt1.coordinates[1],
      lon2 = pt2.coordinates[0],
      lat2 = pt2.coordinates[1],
      dLat = this.numberToRadius(lat2 - lat1),
      dLon = this.numberToRadius(lon2 - lon1),
      a = Math.pow(Math.sin(dLat / 2), 2) + Math.cos(this.numberToRadius(lat1))
        * Math.cos(this.numberToRadius(lat2)) * Math.pow(Math.sin(dLon / 2), 2),
      c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return (6371 * c) * 1000; // returns meters
  },

  pointInPolygon : function (p, poly) {
    var coords = (poly.type == "Polygon") ? [ poly.coordinates ] : poly.coordinates

    var insideBox = false
    for (var i = 0; i < coords.length; i++) {
      if (this.pointInBoundingBox(p, this.boundingBoxAroundPolyCoords(coords[i]))) insideBox = true
    }
    if (!insideBox) return false

    var insidePoly = false
    for (var i = 0; i < coords.length; i++) {
      if (this.pnpoly(p.coordinates[1], p.coordinates[0], coords[i])) insidePoly = true
    }

    return insidePoly
  },

  pointInBoundingBox : function (point, bounds) {
    return !(point.coordinates[1] < bounds[0][0] || point.coordinates[1] > bounds[1][0] || point.coordinates[0] < bounds[0][1] || point.coordinates[0] > bounds[1][1])
  },

  boundingBoxAroundPolyCoords : function(coords) {
    var xAll = [], yAll = []

    for (var i = 0; i < coords[0].length; i++) {
      xAll.push(coords[0][i][1])
      yAll.push(coords[0][i][0])
    }

    xAll = xAll.sort(function (a,b) { return a - b })
    yAll = yAll.sort(function (a,b) { return a - b })

    return [ [xAll[0], yAll[0]], [xAll[xAll.length - 1], yAll[yAll.length - 1]] ]
  },

  // Point in Polygon
  // http://www.ecse.rpi.edu/Homepages/wrf/Research/Short_Notes/pnpoly.html#Listing the Vertices
  pnpoly : function(x,y,coords) {
    var vert = [ [0,0] ]

    for (var i = 0; i < coords.length; i++) {
      for (var j = 0; j < coords[i].length; j++) {
        vert.push(coords[i][j])
      }
      vert.push(coords[i][0])
      vert.push([0,0])
    }

    var inside = false
    for (var i = 0, j = vert.length - 1; i < vert.length; j = i++) {
      if (((vert[i][0] > y) != (vert[j][0] > y)) && (x < (vert[j][1] - vert[i][1]) * (y - vert[i][0]) / (vert[j][0] - vert[i][0]) + vert[i][1])) inside = !inside
    }

    return inside
  },

  numberToRadius : function (number) {
    return number * Math.PI / 180;
  }
};

},{}]},{},[7])(7)
});
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9ncnVudC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJsaWIvc2hhcmVkL2RhdGFzdG9yZS9pbmRleC5qcyIsImxpYi9zaGFyZWQvZmlsZS9pbmRleC5qcyIsImxpYi9zaGFyZWQvZmlsZS9wYXJzZS5qcyIsImxpYi9zaGFyZWQvZmlsZS9wcm9jZXNzLmpzIiwibGliL3NoYXJlZC9maWxlL3NldHVwLmpzIiwibGliL3NoYXJlZC9odWMvaW5kZXguanMiLCJsaWIvc2hhcmVkL2luZGV4LmpzIiwibGliL3NoYXJlZC9sZWFmbGV0L2NhbnZhcy5qcyIsImxpYi9zaGFyZWQvbGVhZmxldC9jYW52YXNQb2ludEZlYXR1cmUuanMiLCJsaWIvc2hhcmVkL2xlYWZsZXQvZHdyYXQuanMiLCJsaWIvc2hhcmVkL2xlYWZsZXQvaW5kZXguanMiLCJsaWIvc2hhcmVkL2xlZ2VuZC9pbmRleC5qcyIsImxpYi9zaGFyZWQvbGVnZW5kL3RlbXBsYXRlLmpzIiwibGliL3NoYXJlZC9saWJyYXJ5L2luZGV4LmpzIiwibGliL3NoYXJlZC9tYXAvZ2VvanNvbi5qcyIsImxpYi9zaGFyZWQvbWFwL2luZGV4LmpzIiwibGliL3NoYXJlZC9tYXJrZXJzL2NvbmZpZy5qcyIsImxpYi9zaGFyZWQvbWFya2Vycy9kcm91Z2h0SWNvbi5qcyIsImxpYi9zaGFyZWQvbWFya2Vycy9pY29uUmVuZGVyZXIuanMiLCJsaWIvc2hhcmVkL21hcmtlcnMvaW5kZXguanMiLCJsaWIvc2hhcmVkL21hcmtlcnMvdXRpbHMuanMiLCJub2RlX21vZHVsZXMvbGVhZmxldC1jYW52YXMtZ2VvanNvbi9zcmMvbGF5ZXIuanMiLCJub2RlX21vZHVsZXMvbGVhZmxldC1jYW52YXMtZ2VvanNvbi9zcmMvdXRpbHMuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4TEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMUtBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pNQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbkNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RCQTtBQUNBO0FBQ0E7QUFDQTs7O0FDSEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUN2SUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNiQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMUhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUMxRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUNsS0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL0NBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDekJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcGhCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsInZhciBkYXRhID0ge1xuICBhbGwgOiBbXSxcbiAgbm9EZW1hbmQgOiBbXSxcbiAgZmVhdHVyZXMgOiBbXVxufTtcblxubW9kdWxlLmV4cG9ydHMuc2V0ID0gZnVuY3Rpb24ocG9pbnRzKSB7XG4gIGRhdGEuYWxsID0gcG9pbnRzO1xuXG4gIHRtcCA9IFtdO1xuICBmb3IoIHZhciBpID0gcG9pbnRzLmxlbmd0aC0xOyBpID49IDA7IGktLSApIHtcbiAgICBpZiggcG9pbnRzW2ldLnByb3BlcnRpZXMuYWxsb2NhdGlvbnMgJiYgcG9pbnRzW2ldLnByb3BlcnRpZXMuYWxsb2NhdGlvbnMubGVuZ3RoID4gMCApIHtcblxuICAgICAgdmFyIGRlbWFuZCA9IHBvaW50c1tpXS5wcm9wZXJ0aWVzLmFsbG9jYXRpb25zWzBdLmRlbWFuZDtcbiAgICAgIGlmKCBkZW1hbmQgIT09IDAgKSB0bXAucHVzaChwb2ludHNbaV0pO1xuICAgIH1cbiAgfVxuICBkYXRhLm5vRGVtYW5kID0gdG1wO1xufTtcblxubW9kdWxlLmV4cG9ydHMuZ2V0ID0gZnVuY3Rpb24obm9EZW1hbmQpIHtcbiAgaWYoIG5vRGVtYW5kICkgcmV0dXJuIGRhdGEubm9EZW1hbmQ7XG4gIHJldHVybiBkYXRhLmFsbDtcbn07XG5cbm1vZHVsZS5leHBvcnRzLmNsZWFyRmVhdHVyZXMgPSBmdW5jdGlvbigpe1xuICBkYXRhLmZlYXR1cmVzID0gW107XG59O1xuXG5tb2R1bGUuZXhwb3J0cy5hZGRGZWF0dXJlID0gZnVuY3Rpb24oZmVhdHVyZSkge1xuICBkYXRhLmZlYXR1cmVzLnB1c2goZmVhdHVyZSk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cy5nZXRGZWF0dXJlcyA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm4gZGF0YS5mZWF0dXJlcztcbn07XG4iLCJ2YXIgcHJvY2VzcyA9IHJlcXVpcmUoJy4vcHJvY2VzcycpO1xuXG52YXIgUVVFUllfU0laRSA9IDEwMDA7XG52YXIgcXVlcnlSb290ID0gJ2h0dHA6Ly9naXNwdWJsaWMud2F0ZXJib2FyZHMuY2EuZ292L2FyY2dpcy9yZXN0L3NlcnZpY2VzL1dhdGVyX1JpZ2h0cy9Qb2ludHNfb2ZfRGl2ZXJzaW9uL01hcFNlcnZlci8wL3F1ZXJ5JztcbnZhciBxdWVyeUFwcElkVmFyID0gJ1dCR0lTLlBvaW50c19vZl9EaXZlcnNpb24uQVBQTF9JRCc7XG52YXIgcXVlcnlMYXRpdHVkZSA9ICdXQkdJUy5Qb2ludHNfb2ZfRGl2ZXJzaW9uLkxBVElUVURFJztcbnZhciBxdWVyeUxvbmdpdHVkZSA9ICdXQkdJUy5Qb2ludHNfb2ZfRGl2ZXJzaW9uLkxPTkdJVFVERSc7XG52YXIgcXVlcnlPdXRmaWVsZHMgPSAgW3F1ZXJ5QXBwSWRWYXIsIHF1ZXJ5TG9uZ2l0dWRlLCBxdWVyeUxhdGl0dWRlXS5qb2luKCcsJyk7XG5cbnZhciBxdWVyeVBhcmFtcyA9IHtcbiAgZiA6ICdqc29uJyxcbiAgd2hlcmUgOiAnJyxcbiAgcmV0dXJuR2VvbWV0cnkgOiAnZmFsc2UnLFxuICBzcGF0aWFsUmVsIDogJ2VzcmlTcGF0aWFsUmVsSW50ZXJzZWN0cycsXG4gIGdlb21ldHJ5IDogJycsXG4gIGdlb21ldHJ5VHlwZSA6ICdlc3JpR2VvbWV0cnlFbnZlbG9wZScsXG4gIGluU1IgOiAnMTAyMTAwJyxcbiAgb3V0RmllbGRzIDogcXVlcnlPdXRmaWVsZHMsXG4gIG91dFNSIDogJzEwMjEwMCdcbn07XG5cbnZhciBIRUFERVJTID0ge1xuICAgIGFwcGxpY2F0aW9uX251bWJlciA6IHtcbiAgICAgICAgcmVxdWlyZWQgOiB0cnVlLFxuICAgICAgICB0eXBlIDogJ3N0cmluZydcbiAgICB9LFxuICAgIGRlbWFuZF9kYXRlIDoge1xuICAgICAgICByZXF1aXJlZCA6IHRydWUsXG4gICAgICAgIHR5cGUgOiAnZGF0ZS1zdHJpbmcnXG4gICAgfSxcbiAgICB3YXRlcnNoZWQgOiB7XG4gICAgICAgIHJlcXVpcmVkIDogZmFsc2UsXG4gICAgICAgIHR5cGUgOiAnc3RyaW5nJ1xuICAgIH0sXG4gICAgc2Vhc29uIDoge1xuICAgICAgICByZXF1aXJlZCA6IGZhbHNlLFxuICAgICAgICB0eXBlIDogJ2Jvb2xlYW4nLFxuICAgIH0sXG4gICAgJ2h1Yy0xMicgOiB7XG4gICAgICAgIHJlcXVpcmVkIDogZmFsc2UsXG4gICAgICAgIHR5cGUgOiAnYm9vbGVhbidcbiAgICB9LFxuICAgIHdhdGVyX3JpZ2h0X3R5cGUgOiB7XG4gICAgICAgIHJlcXVpcmVkIDogZmFsc2UsXG4gICAgICAgIHR5cGUgOiAnc3RyaW5nJ1xuICAgIH0sXG4gICAgcHJpb3JpdHlfZGF0ZSA6IHtcbiAgICAgICAgcmVxdWlyZWQgOiB0cnVlLFxuICAgICAgICB0eXBlIDogJ2RhdGUtc3RyaW5nJ1xuICAgIH0sXG4gICAgcmlwYXJpYW4gOiB7XG4gICAgICAgIHJlcXVpcmVkIDogZmFsc2UsXG4gICAgICAgIHR5cGUgOiAnYm9vbGVhbidcbiAgICB9LFxuICAgIHByZTE5MTQgOiB7XG4gICAgICAgIHJlcXVpcmVkIDogZmFsc2UsXG4gICAgICAgIHR5cGUgOiAnYm9vbGVhbidcbiAgICB9LFxuICAgIGRlbWFuZCA6IHtcbiAgICAgICAgcmVxdWlyZWQgOiB0cnVlLFxuICAgICAgICB0eXBlIDogJ2Zsb2F0J1xuICAgIH0sXG4gICAgYWxsb2NhdGlvbiA6IHtcbiAgICAgICAgcmVxdWlyZWQgOiB0cnVlLFxuICAgICAgICB0eXBlIDogJ2Zsb2F0J1xuICAgIH1cbn07XG5cbnZhciBsb2NhdGlvbnMgPSB7fSwgbWFwLCBkYXRhc3RvcmU7XG5cbmZ1bmN0aW9uIGNyZWF0ZUdlb0pzb24oZGF0YSwgYXR0ck1hcCwgY2FsbGJhY2spIHtcbiAgICAvLyBmaXJzdCBsb2NhdGUgZGF0YVxuICAgICQoJyNmaWxlLWxvY2F0ZScpLmh0bWwoJ0xvY2F0aW5nIGRhdGEuLi4nKTtcblxuICAgIHZhciBpZHMgPSBbXSwga2V5O1xuICAgIHZhciBjb2wgPSBnZXRBdHRyQ29sKCdhcHBsaWNhdGlvbl9udW1iZXInLCBkYXRhLCBhdHRyTWFwKTtcbiAgICBmb3IoIHZhciBpID0gMTsgaSA8IGRhdGEubGVuZ3RoOyBpKysgKSB7XG4gICAgICAgIHZhciBpZCA9IGRhdGFbaV1bY29sXTtcbiAgICAgICAgaWYoICFsb2NhdGlvbnNbaWRdICkgaWRzLnB1c2goZGF0YVtpXVtjb2xdKTtcbiAgICB9XG5cbiAgICBsb2NhdGVEYXRhKDAsIGlkcywgZnVuY3Rpb24oKXtcblxuICAgICAgICAkKCcjZmlsZS1sb2NhdGUnKS5odG1sKCdDcmVhdGluZyBkYXRhLi4uJyk7XG5cbiAgICAgICAgdmFyIGlNYXAgPSB7fTtcbiAgICAgICAgZm9yKCBrZXkgaW4gYXR0ck1hcCApIGlNYXBbYXR0ck1hcFtrZXldXSA9IGtleTtcblxuICAgICAgICB2YXIgZ2VvSnNvbiA9IFtdO1xuICAgICAgICBmb3IoIHZhciBpID0gMTsgaSA8IGRhdGEubGVuZ3RoOyBpKysgKSB7XG4gICAgICAgICAgICBpZiggIWxvY2F0aW9uc1tkYXRhW2ldW2NvbF1dICkgY29udGludWU7XG5cbiAgICAgICAgICAgIHZhciBwID0ge1xuICAgICAgICAgICAgICAgIHR5cGUgOiAnRmVhdHVyZScsXG4gICAgICAgICAgICAgICAgZ2VvbWV0cnkgOiAkLmV4dGVuZCh7fSwgdHJ1ZSwgbG9jYXRpb25zW2RhdGFbaV1bY29sXV0pLFxuICAgICAgICAgICAgICAgIHByb3BlcnRpZXMgOiB7fVxuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgZm9yKCB2YXIgaiA9IDA7IGogPCBkYXRhWzBdLmxlbmd0aDsgaisrICkge1xuICAgICAgICAgICAgICAgIGtleSA9IGRhdGFbMF1bal07XG4gICAgICAgICAgICAgICAgaWYoIGlNYXBba2V5XSApIGtleSA9IGlNYXBba2V5XTtcbiAgICAgICAgICAgICAgICBwLnByb3BlcnRpZXNba2V5XSA9IChIRUFERVJTW2tleV0gJiYgSEVBREVSU1trZXldLnR5cGUgPT0gJ2Zsb2F0JykgPyBwYXJzZUZsb2F0KGRhdGFbaV1bal0pIDogZGF0YVtpXVtqXTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcC5wcm9wZXJ0aWVzLmFsbG9jYXRpb25zID0gW3tcbiAgICAgICAgICAgICAgICBzZWFzb24gOiB0cnVlLFxuICAgICAgICAgICAgICAgIGFsbG9jYXRpb24gOiBwLnByb3BlcnRpZXMuYWxsb2NhdGlvbixcbiAgICAgICAgICAgICAgICBkZW1hbmQgOiBwLnByb3BlcnRpZXMuZGVtYW5kLFxuICAgICAgICAgICAgICAgIGZvcmVjYXN0IDogZmFsc2UsXG4gICAgICAgICAgICAgICAgZGF0ZSA6IHAucHJvcGVydGllcy5kZW1hbmRfZGF0ZSxcbiAgICAgICAgICAgICAgICBwdWJsaWNfaGVhbHRoX2JpbmQgOiBmYWxzZSxcbiAgICAgICAgICAgICAgICB3cmJpbmQgOiBmYWxzZSxcbiAgICAgICAgICAgICAgICByYXRpbyA6IChwLnByb3BlcnRpZXMuZGVtYW5kID4gMCkgPyAocC5wcm9wZXJ0aWVzLmFsbG9jYXRpb24gLyBwLnByb3BlcnRpZXMuZGVtYW5kKSA6IDBcbiAgICAgICAgICAgIH1dO1xuXG4gICAgICAgICAgICBnZW9Kc29uLnB1c2gocCk7XG4gICAgICAgIH1cblxuICAgICAgICBtYXAuY2xlYXJHZW9qc29uTGF5ZXIoKTtcbiAgICAgICAgZGF0YXN0b3JlLnNldChnZW9Kc29uKTtcbiAgICAgICAgbWFwLmdlb2pzb24uYWRkKGdlb0pzb24pO1xuXG4gICAgICAgICQoJyNmaWxlLWxvY2F0ZScpLmh0bWwoJycpO1xuICAgICAgICBjYWxsYmFjaygpO1xuICAgIH0pO1xufVxuXG5mdW5jdGlvbiBnZXRBdHRyQ29sKGF0dHIsIGRhdGEsIG1hcCkge1xuICAgIGlmKCBtYXBbYXR0cl0gKSByZXR1cm4gZGF0YVswXS5pbmRleE9mKG1hcFthdHRyXSk7XG4gICAgcmV0dXJuIGRhdGFbMF0uaW5kZXhPZihhdHRyKTtcbn1cblxuZnVuY3Rpb24gbG9jYXRlRGF0YShpbmRleCwgaWRzLCBjYWxsYmFjaykge1xuXG4gICAgaWYoIGluZGV4KzEgPj0gaWRzLmxlbmd0aCApIHtcbiAgICAgICAgY2FsbGJhY2soKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICB2YXIgaWRHcm91cCA9IFtdO1xuICAgICAgICBcbiAgICAgICAgdmFyIGkgPSAwO1xuICAgICAgICBmb3IoIGkgPSBpbmRleDsgaSA8IGluZGV4K1FVRVJZX1NJWkU7IGkrKyApIHtcbiAgICAgICAgICAgIGlmKCBpZHMubGVuZ3RoID09IGkgKSBicmVhaztcbiAgICAgICAgICAgIGlkR3JvdXAucHVzaChpZHNbaV0pO1xuICAgICAgICB9XG4gICAgICAgIGluZGV4ICs9IFFVRVJZX1NJWkU7XG4gICAgICAgIGNvbnNvbGUubG9nKGluZGV4KTtcblxuICAgICAgICB2YXIgcGFyYW1zID0gJC5leHRlbmQodHJ1ZSwge30sIHF1ZXJ5UGFyYW1zKTtcbiAgICAgICAgcGFyYW1zLndoZXJlID0gcXVlcnlBcHBJZFZhciArICcgaW4gKFxcJycgKyBpZEdyb3VwLmpvaW4oJ1xcJyxcXCcnKSArICdcXCcpJztcblxuICAgICAgICAkLnBvc3QocXVlcnlSb290LCBwYXJhbXMsZnVuY3Rpb24ocmVzcCl7XG4gICAgICAgICAgdmFyIGYsIGk7XG4gICAgICAgICAgZm9yKCBpID0gMDsgaSA8IHJlc3AuZmVhdHVyZXMubGVuZ3RoOyBpKysgKSB7XG4gICAgICAgICAgICBmID0gcmVzcC5mZWF0dXJlc1tpXS5hdHRyaWJ1dGVzO1xuICAgICAgICAgICAgbG9jYXRpb25zW2ZbcXVlcnlBcHBJZFZhcl1dID0ge1xuICAgICAgICAgICAgICB0eXBlOiAnUG9pbnQnLFxuICAgICAgICAgICAgICBjb29yZGluYXRlczogW2ZbcXVlcnlMb25naXR1ZGVdLCBmW3F1ZXJ5TGF0aXR1ZGVdXVxuICAgICAgICAgICAgfTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAkKCcjZmlsZS1sb2NhdGUnKS5odG1sKCdMb2NhdGluZyBkYXRhICcrKChpbmRleC9pZHMubGVuZ3RoKS50b0ZpeGVkKDIpKjEwMCkrJyUuLi4nKTtcbiAgICAgICAgICBsb2NhdGVEYXRhKGluZGV4LCBpZHMsIGNhbGxiYWNrKTtcbiAgICAgICAgfSwnanNvbicpO1xuICAgIH1cbn1cblxuXG5cbnZhciBmaWxlID0ge1xuICBIRUFERVJTIDogSEVBREVSUyxcbiAgaW5pdCA6IGZ1bmN0aW9uKG9wdGlvbnMpe1xuICAgIG1hcCA9IG9wdGlvbnMubWFwO1xuICAgIGRhdGFzdG9yZSA9IG9wdGlvbnMuZGF0YXN0b3JlO1xuICAgIG9wdGlvbnMuZmlsZSA9IHRoaXM7XG5cbiAgICByZXF1aXJlKCcuL3NldHVwJykocHJvY2Vzcyk7XG4gICAgcHJvY2Vzcy5pbml0KG9wdGlvbnMpO1xuICB9LFxuICBjcmVhdGVHZW9Kc29uIDogY3JlYXRlR2VvSnNvbixcbiAgcHJvY2VzcyA6IHByb2Nlc3Ncbn07XG5cblxubW9kdWxlLmV4cG9ydHMgPSBmaWxlO1xuIiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbih0eXBlLCBjb250ZW50cywgY2FsbGJhY2spIHtcbiAgICBpZiggdHlwZSA9PSAneGxzeCcgKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBmdW5jdGlvbiBvblhsc3hDb21wbGV0ZSh3Yil7XG4gICAgICAgICAgICAgICAgc2VsZWN0V29ya3NoZWV0KHdiLlNoZWV0TmFtZXMsIGZ1bmN0aW9uKHNoZWV0TmFtZSl7XG4gICAgICAgICAgICAgICAgICAgIHZhciBjc3YgPSBYTFNYLnV0aWxzLnNoZWV0X3RvX2Nzdih3Yi5TaGVldHNbc2hlZXROYW1lXSk7XG4gICAgICAgICAgICAgICAgICAgICQuY3N2LnRvQXJyYXlzKGNzdiwge30sIGZ1bmN0aW9uKGVyciwgZGF0YSl7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiggZXJyICkgcmV0dXJuIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhudWxsLCBkYXRhKTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHZhciB3b3JrZXIgPSBuZXcgV29ya2VyKCdib3dlcl9jb21wb25lbnRzL2pzLXhsc3gveGxzeHdvcmtlci5qcycpO1xuICAgICAgICAgICAgd29ya2VyLm9ubWVzc2FnZSA9IGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgICAgICAgICBzd2l0Y2goZS5kYXRhLnQpIHtcbiAgICAgICAgICAgICAgICAgICAgY2FzZSAncmVhZHknOiBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgY2FzZSAnZSc6IGNvbnNvbGUuZXJyb3IoZS5kYXRhLmQpOyBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgY2FzZSAneGxzeCc6IG9uWGxzeENvbXBsZXRlKEpTT04ucGFyc2UoZS5kYXRhLmQpKTsgYnJlYWs7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIHdvcmtlci5wb3N0TWVzc2FnZSh7ZDpjb250ZW50cyxiOnRydWV9KTtcblxuICAgICAgICB9IGNhdGNoKGUpIHtcbiAgICAgICAgICAgIGNhbGxiYWNrKGUpO1xuICAgICAgICB9XG5cbiAgICB9IGVsc2UgaWYoIGluZm8uZXh0ID09ICd4bHMnICkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgZnVuY3Rpb24gb25YbHNDb21wbGV0ZSh3Yil7XG4gICAgICAgICAgICAgICAgc2VsZWN0V29ya3NoZWV0KHdiLlNoZWV0TmFtZXMsIGZ1bmN0aW9uKHNoZWV0TmFtZSl7XG4gICAgICAgICAgICAgICAgICAgIHZhciBjc3YgPSBYTFMudXRpbHMuc2hlZXRfdG9fY3N2KHdiLlNoZWV0c1tzaGVldE5hbWVdKTtcbiAgICAgICAgICAgICAgICAgICAgJC5jc3YudG9BcnJheXMoY3N2LCB7fSwgZnVuY3Rpb24oZXJyLCBkYXRhKXtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmKCBlcnIgKSByZXR1cm4gY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKG51bGwsIGRhdGEpO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdmFyIHdvcmtlciA9IG5ldyBXb3JrZXIoJ2Jvd2VyX2NvbXBvbmVudHMvanMteGxzL3hsc3dvcmtlci5qcycpO1xuICAgICAgICAgICAgd29ya2VyLm9ubWVzc2FnZSA9IGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgICAgICAgICBzd2l0Y2goZS5kYXRhLnQpIHtcbiAgICAgICAgICAgICAgICAgICAgY2FzZSAncmVhZHknOiBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgY2FzZSAnZSc6IGNvbnNvbGUuZXJyb3IoZS5kYXRhLmQpOyBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgY2FzZSAneGxzeCc6IG9uWGxzQ29tcGxldGUoSlNPTi5wYXJzZShlLmRhdGEuZCkpOyBicmVhaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgd29ya2VyLnBvc3RNZXNzYWdlKHtkOmNvbnRlbnRzLGI6dHJ1ZX0pO1xuXG4gICAgICAgIH0gY2F0Y2goZSkge1xuICAgICAgICAgICAgZGVidWdnZXI7XG4gICAgICAgICAgICB0aGlzLm9uQ29tcGxldGUoZSwgbnVsbCwgaW5mbywgMSwgMSwgYXJyLCBjYWxsYmFjayk7XG4gICAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgdmFyIG9wdGlvbnMgPSB7fTtcbiAgICAgICAgICAgIC8vaWYoIGluZm8ucGFyc2VyID09ICdjc3YtdGFiJyApIG9wdGlvbnMuc2VwYXJhdG9yID0gJ1xcdCc7XG5cbiAgICAgICAgICAgICQuY3N2LnRvQXJyYXlzKGNvbnRlbnRzLCBvcHRpb25zLCBmdW5jdGlvbihlcnIsIGRhdGEpe1xuICAgICAgICAgICAgICAgIGlmKCBlcnIgKSByZXR1cm4gY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgICAgICBjYWxsYmFjayhudWxsLCBkYXRhKTtcbiAgICAgICAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgICAgIH0gY2F0Y2goZSkge1xuICAgICAgICAgICAgZGVidWdnZXI7XG4gICAgICAgICAgICB0aGlzLm9uQ29tcGxldGUoZSwgbnVsbCwgaW5mbywgMSwgMSwgYXJyLCBjYWxsYmFjayk7XG4gICAgICAgIH1cbiAgICB9XG59XG4iLCJ2YXIgcGFyc2UgPSByZXF1aXJlKCcuL3BhcnNlJyk7XG5cbi8vIG5hbWVzIERXUiBrZWVwcyB1c2luZyB0aG91Z2ggd2UgZGlzY3Vzc2VkIG90aGVyd2lzZS4uLlxudmFyIHByZXZpb3VzQXR0ck1hcCA9IHtcbiAgJ2FwcGxpY2F0aW9uX251bWJlcicgOiAnQXBwSUQnLFxuICAnZGVtYW5kX2RhdGUnIDogJ1B1bGwgRGF0ZScsXG4gICdwcmlvcml0eV9kYXRlJzogJ0ZpbGUgRGF0ZSdcbn07XG5cbnZhciBmaWxlLCBtYXAsIGZpbGVuYW1lID0gJycsIGh1YztcblxubW9kdWxlLmV4cG9ydHMuaW5pdCA9IGZ1bmN0aW9uKG9wdGlvbnMpIHtcbiAgZmlsZSA9IG9wdGlvbnMuZmlsZTtcbiAgbWFwID0gb3B0aW9ucy5tYXA7XG4gIGh1YyA9IG9wdGlvbnMuaHVjO1xufTtcblxuLy8gcHJvY2VzcyBhIGZpbGVcbm1vZHVsZS5leHBvcnRzLnJ1biA9IGZ1bmN0aW9uKGUpIHtcbiAgZS5zdG9wUHJvcGFnYXRpb24oKTtcbiAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICB2YXIgZmlsZXMgPSBlLmRhdGFUcmFuc2ZlciA/IGUuZGF0YVRyYW5zZmVyLmZpbGVzIDogZS50YXJnZXQuZmlsZXM7IC8vIEZpbGVMaXN0IG9iamVjdC5cblxuICBpZiggZmlsZXMubGVuZ3RoID4gMCApIHtcbiAgICAkKCcjZmlsZS1sb2NhdGUnKS5odG1sKCdMb2FkaW5nIGZpbGUuLi4nKTtcbiAgICBmaWxlbmFtZSA9IGZpbGVzWzBdLm5hbWU7XG4gICAgcmVhZChmaWxlc1swXSk7XG4gIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzLnNldEZpbGVuYW1lID0gZnVuY3Rpb24obmFtZSkge1xuICBmaWxlbmFtZSA9IG5hbWU7XG59O1xuXG5mdW5jdGlvbiBpbXBvcnRDb250ZW50cyh0eXBlLCBjb250ZW50cywgY2FsbGJhY2spIHtcbiAgcGFyc2UodHlwZSwgY29udGVudHMsIG9uRmlsZVBhcnNlZCk7XG59XG5tb2R1bGUuZXhwb3J0cy5pbXBvcnRDb250ZW50cyA9IGltcG9ydENvbnRlbnRzO1xuXG5mdW5jdGlvbiBvbkZpbGVQYXJzZWQoZXJyLCBkYXRhKSB7XG4gICQoJyNmaWxlLWxvY2F0ZScpLmh0bWwoJycpO1xuICBtYXRjaENvbHMoZGF0YSwgZnVuY3Rpb24oY29sTWFwKXtcblxuICAgIC8vIG5vdyBsb2NhdGUgZGF0YSBhbmQgY3JlYXRlXG4gICAgZmlsZS5jcmVhdGVHZW9Kc29uKGRhdGEsIGNvbE1hcCwgdXBkYXRlVWlQb3N0SW1wb3J0KTtcbiAgfSk7XG59XG5tb2R1bGUuZXhwb3J0cy5vbkZpbGVQYXJzZWQgPSBvbkZpbGVQYXJzZWQ7XG5cbmZ1bmN0aW9uIHVwZGF0ZVVpUG9zdEltcG9ydCgpIHtcbiAgJCgnI2RhdGUtc2VsZWN0aW9uJykuaGlkZSgpO1xuICAkKCcjZmlsZS1zZWxlY3Rpb24nKS5odG1sKCc8YSBjbGFzcz1cImJ0biBidG4tbGlua1wiIGlkPVwicmVtb3ZlLWZpbGUtYnRuXCI+JytmaWxlbmFtZSsnIDxpIGNsYXNzPVwiZmEgZmEtdGltZXNcIj48L2k+PC9hPicpO1xuXG4gICQoJyNyZW1vdmUtZmlsZS1idG4nKS5vbignY2xpY2snLGZ1bmN0aW9uKCl7XG4gICAgbWFwLmdlb2pzb24uY2xlYXJMYXllcigpO1xuICAgIGh1Yy5jbGVhcigpO1xuICAgICQoJyNkYXRlLXNlbGVjdGlvbicpLnNob3coKTtcbiAgICAkKCcjZmlsZS1zZWxlY3Rpb24nKS5odG1sKCcnKTtcbiAgfSk7XG5cbiAgJCgnI2ZpbGUtaW5wdXQnKS52YWwoJycpO1xuICAkKCcjdG9hc3QnKS5oaWRlKCk7XG59XG5cbmZ1bmN0aW9uIHJlYWQocmF3KSB7XG4gICAgX3Jlc2V0VUkoKTtcblxuICAgIHZhciB0eXBlID0gJ3RleHQnO1xuXG4gICAgdmFyIHJlYWRlciA9IG5ldyBGaWxlUmVhZGVyKCk7XG4gICAgcmVhZGVyLm9ubG9hZCA9IGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgaW1wb3J0Q29udGVudHModHlwZSwgZS50YXJnZXQucmVzdWx0KTtcbiAgICB9O1xuXG4gICAgaWYoIHJhdy5uYW1lLm1hdGNoKC8uKlxcLnhsc3g/JC8pICkge1xuICAgICAgICB0eXBlID0gcmF3Lm5hbWUucmVwbGFjZSgvLipcXC4vLCcnKTtcbiAgICAgICAgcmVhZGVyLnJlYWRBc0JpbmFyeVN0cmluZyhyYXcpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHJlYWRlci5yZWFkQXNUZXh0KHJhdyk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBtYXRjaENvbHMoZGF0YSwgY2FsbGJhY2spIHtcbiAgICBpZiggZGF0YS5sZW5ndGggPT0gMCApIHJldHVybiBhbGVydCgnWW91ciBmaWxlIGlzIGVtcHR5Jyk7XG5cbiAgICB2YXIgbWF0Y2hlcyA9IFtdO1xuICAgIHZhciByZXF1aXJlZE1pc21hdGNoZXMgPSBbXTtcbiAgICB2YXIgbWFwcGVkID0gcHJldmlvdXNBdHRyTWFwO1xuXG4gICAgdmFyIGZsYXR0ZW4gPSBbXTtcbiAgICBmb3IoIHZhciBpID0gMDsgaSA8IGRhdGFbMF0ubGVuZ3RoOyBpKysgKSB7XG4gICAgICBmbGF0dGVuLnB1c2goZGF0YVswXVtpXS50b0xvd2VyQ2FzZSgpKTtcbiAgICB9XG5cbiAgICBmb3IoIHZhciBrZXkgaW4gZmlsZS5IRUFERVJTICkge1xuICAgICAgICBpZiggcHJldmlvdXNBdHRyTWFwW2tleV0gJiYgZmxhdHRlbi5pbmRleE9mKHByZXZpb3VzQXR0ck1hcFtrZXldLnRvTG93ZXJDYXNlKCkpID4gLTEgKSB7XG4gICAgICAgICAgICBtYXRjaGVzLnB1c2goa2V5KTtcbiAgICAgICAgfSBlbHNlIGlmKCBmbGF0dGVuLmluZGV4T2Yoa2V5LnRvTG93ZXJDYXNlKCkpID09IC0xICYmIGZpbGUuSEVBREVSU1trZXldLnJlcXVpcmVkICkge1xuICAgICAgICAgICAgcmVxdWlyZWRNaXNtYXRjaGVzLnB1c2goa2V5KTtcbiAgICAgICAgfSBlbHNlIGlmKCBmbGF0dGVuLmluZGV4T2Yoa2V5LnRvTG93ZXJDYXNlKCkpID4gLTEgKSB7XG4gICAgICAgICAgaWYoIGRhdGFbMF0uaW5kZXhPZihrZXkpID4gLTEgKSB7XG4gICAgICAgICAgICBtYXRjaGVzLnB1c2goa2V5KTtcbiAgICAgICAgICB9IGVsc2UgeyAvLyB0aGUgY2FzZSBkaWZmZXJzLCBhZGQgaXQgdG8gdGhlIGF0dHJpYnV0ZSBtYXBcbiAgICAgICAgICAgIHZhciBpbmRleCA9IGZsYXR0ZW4uaW5kZXhPZihrZXkudG9Mb3dlckNhc2UoKSk7XG4gICAgICAgICAgICBwcmV2aW91c0F0dHJNYXBba2V5XSA9IGRhdGFbMF1baW5kZXhdO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgICQoJyNmaWxlLW1vZGFsJykubW9kYWwoJ2hpZGUnKTtcblxuICAgIGlmKCByZXF1aXJlZE1pc21hdGNoZXMubGVuZ3RoID09IDAgKSByZXR1cm4gY2FsbGJhY2socHJldmlvdXNBdHRyTWFwKTtcblxuICAgIC8vIG1ha2Ugc3VyZSBtb2RhbCBpcyBzaG93aW5nXG4gICAgJCgnI21hdGNoLW1vZGFsJykubW9kYWwoJ3Nob3cnKTtcblxuICAgIHZhciB0YWJsZSA9ICc8dGFibGUgY2xhc3M9XCJ0YWJsZVwiPic7XG4gICAgZm9yKCB2YXIgaSA9IDA7IGkgPCByZXF1aXJlZE1pc21hdGNoZXMubGVuZ3RoOyBpKysgKSB7XG4gICAgICAgIHRhYmxlICs9ICc8dHI+PHRkPicrcmVxdWlyZWRNaXNtYXRjaGVzW2ldKyc8L3RkPjx0ZD4nK19jcmVhdGVNYXRjaFNlbGVjdG9yKHJlcXVpcmVkTWlzbWF0Y2hlc1tpXSwgZGF0YVswXSwgbWF0Y2hlcykrJzwvdGQ+PC90cj4nO1xuICAgIH1cbiAgICB0YWJsZSArPSAnPC90YWJsZT4nO1xuXG4gICAgJCgnI21hdGNoVGFibGUnKS5odG1sKCc8ZGl2IHN0eWxlPVwibWFyZ2luLXRvcDoyMHB4O2ZvbnQtd2VpZ2h0OmJvbGRcIj5QbGVhc2UgbWF0Y2ggdGhlIGZvbGxvd2luZyByZXF1aXJlZCBjb2x1bW5zIHRvIGNvbnRpbnVlPC9kaXY+Jyt0YWJsZSk7XG4gICAgJCgnLm1hdGNoLXNlbGVjdG9yJykub24oJ2NoYW5nZScsIGZ1bmN0aW9uKCl7XG4gICAgICAgIHZhciBrZXkgPSAkKHRoaXMpLmF0dHIoJ2tleScpO1xuICAgICAgICB2YXIgdmFsID0gJCh0aGlzKS52YWwoKTtcblxuICAgICAgICBpZiggdmFsID09ICcnIHx8ICF2YWwgKSB7XG4gICAgICAgICAgICBkZWxldGUgbWFwcGVkW2tleV07XG4gICAgICAgICAgICByZXF1aXJlZE1pc21hdGNoZXMucHVzaChrZXkpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbWFwcGVkW2tleV0gPSB2YWw7XG4gICAgICAgICAgICB2YXIgaW5kZXggPSByZXF1aXJlZE1pc21hdGNoZXMuaW5kZXhPZihrZXkpO1xuICAgICAgICAgICAgaWYgKGluZGV4ID4gLTEpIHJlcXVpcmVkTWlzbWF0Y2hlcy5zcGxpY2UoaW5kZXgsIDEpO1xuICAgICAgICB9XG5cblxuICAgICAgICBpZiggcmVxdWlyZWRNaXNtYXRjaGVzLmxlbmd0aCA9PSAwICkge1xuICAgICAgICAgICAgJCgnI21hdGNoLW1vZGFsJykubW9kYWwoJ2hpZGUnKTtcbiAgICAgICAgICAgICQoJyNtYXRjaFRhYmxlJykuaHRtbCgnJyk7XG4gICAgICAgICAgICBwcmV2aW91c0F0dHJNYXAgPSBtYXBwZWQ7XG4gICAgICAgICAgICBjYWxsYmFjayhtYXBwZWQpO1xuICAgICAgICB9XG4gICAgfSk7XG59XG5cblxuZnVuY3Rpb24gX3Jlc2V0VUkoKSB7XG4gICAgJCgnI21hdGNoVGFibGUnKS5odG1sKCcnKTtcbiAgICAkKCcjZmlsZS1sb2NhdGUnKS5odG1sKCcnKTtcbn1cblxuZnVuY3Rpb24gX2NyZWF0ZU1hdGNoU2VsZWN0b3Ioa2V5LCBhcnIsIG1hdGNoZXMpIHtcbiAgICB2YXIgc2VsZWN0ID0gJzxzZWxlY3QgY2xhc3M9XCJtYXRjaC1zZWxlY3RvclwiIGtleT1cIicra2V5KydcIj48b3B0aW9uPjwvb3B0aW9uPic7XG5cbiAgICBmb3IoIHZhciBpID0gMDsgaSA8IGFyci5sZW5ndGg7IGkrKyApIHtcbiAgICAgICAgaWYoIG1hdGNoZXMuaW5kZXhPZihhcnJbaV0pID4gLTEgKSBjb250aW51ZTtcbiAgICAgICAgc2VsZWN0ICs9ICc8b3B0aW9uIHZhbHVlPVwiJythcnJbaV0rJ1wiPicrYXJyW2ldKyc8L29wdGlvbj4nO1xuICAgIH1cbiAgICByZXR1cm4gc2VsZWN0ICsgJzwvc2VsZWN0Pic7XG59XG5cbmZ1bmN0aW9uIHNlbGVjdFdvcmtzaGVldChzaGVldE5hbWVzLCBjYWxsYmFjaykge1xuICAgIGNvbnNvbGUubG9nKHNoZWV0TmFtZXMpO1xuXG4gICAgaWYoIHNoZWV0TmFtZXMubGVuZ3RoID09IDEgKSBjYWxsYmFjayhzaGVldE5hbWVzWzBdKTtcblxuICAgIC8vIGFkZCBVSSBpbnRlcmFjdGlvbiBoZXJlXG4gICAgY2FsbGJhY2soc2hlZXROYW1lc1swXSk7XG59XG4iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKHByb2Nlc3MpIHtcbiAgJCgnI2Nsb3NlLXBvcHVwJykub24oJ2NsaWNrJywgZnVuY3Rpb24oKXtcbiAgICAkKCcjaW5mbycpLnJlbW92ZUNsYXNzKCdmYWRlSW5Eb3duJykuYWRkQ2xhc3MoJ3NsaWRlT3V0UmlnaHQnKTtcblxuICAgIC8vbGVnZW5kLnNlbGVjdChudWxsKTtcbiAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCl7XG4gICAgICAkKCcjaW5mbycpLmhpZGUoKS5hZGRDbGFzcygnZmFkZUluRG93bicpLnJlbW92ZUNsYXNzKCdzbGlkZU91dFJpZ2h0Jyk7XG4gICAgfSwgODAwKTtcbiAgfSk7XG5cbiAgLy8gZmlsZSB1cGxvYWQgc3R1ZmZcbiAgJCgnI2ZpbGUtbW9kYWwnKS5tb2RhbCh7c2hvdzpmYWxzZX0pO1xuICAkKCcjZmlsZS1pbnB1dCcpLm9uKCdjaGFuZ2UnLCBmdW5jdGlvbihlKSB7XG4gICAgcHJvY2Vzcy5ydW4oZSk7XG4gIH0pO1xuICAkKCcjdXBsb2FkLWJ0bicpLm9uKCdjbGljaycsIGZ1bmN0aW9uKCl7XG4gICAgJCgnI2ZpbGUtbW9kYWwnKS5tb2RhbCgnc2hvdycpO1xuICB9KTtcblxuICAkKCdib2R5Jykub24oJ2RyYWdvdmVyJywgZnVuY3Rpb24oZSl7XG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XG5cbiAgICAkKCcjdXBsb2FkLWRyb3AtbWVzc2FnZScpLnNob3coKTtcbiAgICAkKCcjd3JhcHBlcicpLmNzcygnb3BhY2l0eScsIDAuMyk7XG4gIH0pLm9uKCdkcmFnbGVhdmUnLCBmdW5jdGlvbihlKXtcbiAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcblxuICAgICQoJyN1cGxvYWQtZHJvcC1tZXNzYWdlJykuaGlkZSgpO1xuICAgICQoJyN3cmFwcGVyJykuY3NzKCdvcGFjaXR5JywxKTtcbiAgfSkub24oJ2Ryb3AnLCBmdW5jdGlvbihlKXtcbiAgICAkKCcjdXBsb2FkLWRyb3AtbWVzc2FnZScpLmhpZGUoKTtcbiAgICAkKCcjd3JhcHBlcicpLmNzcygnb3BhY2l0eScsMSk7XG5cbiAgICBwcm9jZXNzLnJ1bihlLm9yaWdpbmFsRXZlbnQpO1xuICAgICQoJyNmaWxlLW1vZGFsJykubW9kYWwoJ3Nob3cnKTtcblxuICB9KTtcbn07XG4iLCJ2YXIgbWFya2VyQ29uZmlnID0gcmVxdWlyZSgnLi4vbWFya2Vycy9jb25maWcnKTtcblxudmFyIG1hcDtcbnZhciBsYXllcnMgPSBbXTtcbnZhciBwb2ludHNCeUh1YyA9IHt9O1xudmFyIHVybFByZWZpeCA9ICdodHRwOi8vd2F0ZXJzaGVkLmljZS51Y2RhdmlzLmVkdS92aXpzb3VyY2UvcmVzdD92aWV3PWdldF9odWNfYnlfaWQoXFwnJztcbnZhciB1cmxQb3N0aXggPSAnXFwnKSZ0cT1TRUxFQ1QgKic7XG5cbnZhciBsb29rdXBVcmwgPSAnaHR0cDovL2F0bGFzLmN3cy51Y2RhdmlzLmVkdS9hcmNnaXMvcmVzdC9zZXJ2aWNlcy9XYXRlcnNoZWRzL01hcFNlcnZlci8wL3F1ZXJ5Pyc7XG52YXIgbG9va3VwUGFyYW1zID0ge1xuICAgIHdoZXJlIDogJycsXG4gICAgZ2VvbWV0cnlUeXBlIDogJ2VzcmlHZW9tZXRyeUVudmVsb3BlJyxcbiAgICBzcGF0aWFsUmVsIDogJ2VzcmlTcGF0aWFsUmVsSW50ZXJzZWN0cycsXG4gICAgb3V0RmllbGRzIDogJyonLFxuICAgIHJldHVybkdlb21ldHJ5IDogJ3RydWUnLFxuICAgIG91dFNSIDogJzQzMjYnLFxuICAgIGYgOiAncGpzb24nXG59O1xuXG52YXIgaHVjQ2FjaGUgPSB7fTtcbnZhciByZXF1ZXN0ZWQgPSB7fTtcblxudmFyIHNob3dpbmcgPSB0cnVlO1xudmFyIGN1cnJlbnRQb2ludHMgPSBudWxsO1xuXG5mdW5jdGlvbiBpbml0KG9wdGlvbnMpIHtcbiAgbWFwID0gb3B0aW9ucy5tYXAuZ2V0TGVhZmxldCgpO1xuXG4gICQoJyNyZW5kZXJIdWNBdmcnKS5vbignY2hhbmdlJywgZnVuY3Rpb24oKXtcbiAgICBzaG93aW5nID0gJCh0aGlzKS5pcygnOmNoZWNrZWQnKTtcbiAgICBvblZpc2liaWxpdHlVcGRhdGUoc2hvd2luZyk7XG4gIH0pO1xufVxuXG5mdW5jdGlvbiBvblZpc2liaWxpdHlVcGRhdGUoKSB7XG4gIGlmKCAhc2hvd2luZyApIHtcbiAgICBjbGVhcigpO1xuICB9IGVsc2UgaWYoIGN1cnJlbnRQb2ludHMgIT09IG51bGwgKXtcbiAgICByZW5kZXIoY3VycmVudFBvaW50cyk7XG4gIH1cbn1cblxuZnVuY3Rpb24gY2xlYXIoKSB7XG4gIC8vIGNsZWFyIGFsbCBsYXllcnNcbiAgZm9yKCB2YXIgaSA9IDA7IGkgPCBsYXllcnMubGVuZ3RoOyBpKysgKSB7XG4gICAgbWFwLnJlbW92ZUxheWVyKGxheWVyc1tpXSk7XG4gIH1cbiAgbGF5ZXJzID0gW107XG4gIHBvaW50c0J5SHVjID0ge307XG59XG5cbmZ1bmN0aW9uIHJlbmRlcihwb2ludHMpIHtcbiAgY3VycmVudFBvaW50cyA9IHBvaW50cztcbiAgaWYoICFzaG93aW5nICkgcmV0dXJuO1xuXG4gIGNsZWFyKCk7XG5cbiAgLy8gb3JnYW5pemUgcG9pbnRzIGJ5IGh1Y1xuICB2YXIgaHVjO1xuICBmb3IoIHZhciBpID0gMDsgaSA8IGN1cnJlbnRQb2ludHMubGVuZ3RoOyBpKysgKSB7XG4gICAgLy8gVE9ETzogZGlkIHF1aW5uIGNoYW5nZSB0aGlzP1xuICAgIGh1YyA9IHBvaW50c1tpXS5wcm9wZXJ0aWVzWydodWMtMTInXSB8fCBwb2ludHNbaV0ucHJvcGVydGllcy5odWNfMTI7XG5cbiAgICBpZiggcG9pbnRzQnlIdWNbaHVjXSApIHBvaW50c0J5SHVjW2h1Y10ucHVzaChwb2ludHNbaV0pO1xuICAgIGVsc2UgcG9pbnRzQnlIdWNbaHVjXSA9IFtwb2ludHNbaV1dO1xuICB9XG5cbiAgLy8gcmVxdWVzdCBtaXNzaW5nIGh1YyBnZW9qc29uIGFuZC9vciByZW5kZXIgaHVjXG4gIGZvciggdmFyIGh1YyBpbiBwb2ludHNCeUh1YyApIHtcbiAgICBpZiggaHVjID09PSB1bmRlZmluZWQgfHwgaHVjID09PSAndW5kZWZpbmVkJyApIHtcbiAgICAgIGRlYnVnZ2VyO1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgaWYoIGh1Y0NhY2hlW2h1Y10gKSByZW5kZXJIdWMoaHVjKTtcbiAgICBlbHNlIGlmKCAhcmVxdWVzdGVkW2h1Y10gKSByZXF1ZXN0KGh1Yyk7XG4gIH1cbn1cblxuZnVuY3Rpb24gcmVxdWVzdChodWNJZCkge1xuICByZXF1ZXN0ZWRbaHVjSWRdID0gMTtcblxuICB2YXIgcGFyYW1zID0gJC5leHRlbmQodHJ1ZSwge30sIGxvb2t1cFBhcmFtcyk7XG4gIHBhcmFtcy53aGVyZSA9ICdIVUNfMTIgPSBcXCcnK2h1Y0lkKydcXCcnO1xuICB2YXIgcGFyYW1UZXh0ID0gW107XG4gIGZvciggdmFyIGtleSBpbiBwYXJhbXMgKSB7XG4gICAgcGFyYW1UZXh0LnB1c2goa2V5Kyc9JytlbmNvZGVVUklDb21wb25lbnQocGFyYW1zW2tleV0pKTtcbiAgfVxuICAkLmdldChsb29rdXBVcmwrcGFyYW1UZXh0LmpvaW4oJyYnKSwgb25Mb29rdXBSZXNwb25zZSk7XG5cbiAgLyp2YXIgcXVlcnkgPSBuZXcgZ29vZ2xlLnZpc3VhbGl6YXRpb24uUXVlcnkodXJsUHJlZml4K2h1Y0lkK3VybFBvc3RpeCk7XG4gIHF1ZXJ5LnNldFRpbWVvdXQoNjAqNSk7IC8vIDUgbWluIHRpbWVvdXRcbiAgcXVlcnkuc2VuZChmdW5jdGlvbihyZXNwb25zZSl7XG4gICAgaWYgKHJlc3BvbnNlLmlzRXJyb3IoKSApIHJldHVybiBhbGVydCgnRXJyb3IgcmV0cmlldmluZyBIVUMgMTIgZGF0YSBmb3IgaWQgXCInK2h1Y0lkKydcIicpO1xuXG4gICAgdmFyIGRhdGEgPSByZXNwb25zZS5nZXREYXRhVGFibGUoKTtcblxuICAgIGlmKCBkYXRhLmdldE51bWJlck9mUm93cygpID09IDAgKSB7XG4gICAgICBkZWJ1Z2dlcjtcbiAgICAgIHJldHVybiBhbGVydCgnRXJyb3I6IGludmFsaWQgSFVDIDEyIGlkIFwiJytodWNJZCtcIidcIik7XG4gICAgfVxuXG4gICAgdmFyIGdlb21ldHJ5ID0gSlNPTi5wYXJzZShkYXRhLmdldFZhbHVlKDAsIDApKTtcbiAgICB2YXIgZ2VvanNvbkZlYXR1cmUgPSB7XG4gICAgICBcInR5cGVcIjogXCJGZWF0dXJlXCIsXG4gICAgICBcInByb3BlcnRpZXNcIjoge1xuICAgICAgICAgIFwiaWRcIjogaHVjSWQsXG4gICAgICB9LFxuICAgICAgXCJnZW9tZXRyeVwiOiBnZW9tZXRyeVxuICAgIH07XG4gICAgaHVjQ2FjaGVbaHVjSWRdID0gZ2VvanNvbkZlYXR1cmU7XG5cbiAgICByZW5kZXJIdWMoaHVjSWQpO1xuICB9KTsqL1xufVxuXG5mdW5jdGlvbiBvbkxvb2t1cFJlc3BvbnNlKHJlc3ApIHtcbiAgaWYoIHR5cGVvZiByZXNwID09PSAnc3RyaW5nJyApIHtcbiAgICByZXNwID0gSlNPTi5wYXJzZShyZXNwKTtcbiAgfVxuXG4gIGlmKCByZXNwLmZlYXR1cmVzICYmIHJlc3AuZmVhdHVyZXMubGVuZ3RoID4gMCApIHtcbiAgICB2YXIgZmVhdHVyZSA9IHJlc3AuZmVhdHVyZXNbMF07XG5cblxuICAgIHZhciBnZW9qc29uID0ge1xuICAgICAgJ3R5cGUnOiAnRmVhdHVyZScsXG4gICAgICAncHJvcGVydGllcyc6IGZlYXR1cmUuYXR0cmlidXRlcyxcbiAgICAgICdnZW9tZXRyeSc6IHtcbiAgICAgICAgdHlwZSA6ICdQb2x5Z29uJyxcbiAgICAgICAgY29vcmRpbmF0ZXMgOiBmZWF0dXJlLmdlb21ldHJ5LnJpbmdzXG4gICAgICB9XG4gICAgfTtcblxuICAgIGdlb2pzb24ucHJvcGVydGllcy5pZCA9IGdlb2pzb24ucHJvcGVydGllcy5IVUNfMTI7XG5cbiAgICBodWNDYWNoZVtnZW9qc29uLnByb3BlcnRpZXMuaWRdID0gZ2VvanNvbjtcbiAgICBpZiggIWdlb2pzb24ucHJvcGVydGllcy5pZCApIHtcbiAgICAgIGNvbnNvbGUubG9nKCdiYWQgcmVzcG9uc2UgbG9va2luZyB1cCBIVUM6Jyk7XG4gICAgICBjb25zb2xlLmxvZyhmZWF0dXJlKTtcbiAgICB9XG5cbiAgICByZW5kZXJIdWMoZ2VvanNvbi5wcm9wZXJ0aWVzLmlkKTtcbiAgfVxufVxuXG5mdW5jdGlvbiByZW5kZXJIdWMoaWQpIHtcbiAgaWYoICFzaG93aW5nICkgcmV0dXJuO1xuXG4gIHZhciBwb2ludHMgPSBwb2ludHNCeUh1Y1tpZF07XG5cbiAgaWYoICFwb2ludHMgKSB7XG4gICAgYWxlcnQoJ1VuYWJsZWQgdG8gbG9va3VwIHBvaW50cyBmb3IgSFVDOiAnK2lkKTtcbiAgICByZXR1cm47XG4gIH1cblxuICAvLyBjYWxjdWxhdGUgcGVyY2VudCBkZW1hbmRcbiAgdmFyIHBlcmNlbnREZW1hbmRzID0gW10sIGZlYXR1cmU7XG4gIGZvciggdmFyIGkgPSAwOyBpIDwgcG9pbnRzLmxlbmd0aDsgaSsrICkge1xuICAgIGZlYXR1cmUgPSBwb2ludHNbaV07XG5cbiAgICBpZiggZmVhdHVyZS5wcm9wZXJ0aWVzLmFsbG9jYXRpb25zICYmIGZlYXR1cmUucHJvcGVydGllcy5hbGxvY2F0aW9ucy5sZW5ndGggPiAwICkge1xuICAgICAgdmFyIGRlbWFuZCA9IGZlYXR1cmUucHJvcGVydGllcy5hbGxvY2F0aW9uc1swXS5kZW1hbmQ7XG4gICAgICB2YXIgYWxsb2NhdGlvbiA9IGZlYXR1cmUucHJvcGVydGllcy5hbGxvY2F0aW9uc1swXS5hbGxvY2F0aW9uO1xuXG4gICAgICBpZiggZGVtYW5kICE9IDAgKSB7XG4gICAgICAgIHBlcmNlbnREZW1hbmRzLnB1c2goYWxsb2NhdGlvbiAvIGRlbWFuZCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLy8gY2FsYyBhdmVyYWdlXG4gIHZhciBhdmdQcmVjZW50RGVtYW5kID0gLTE7XG4gIHZhciB0bXAgPSAwO1xuICBmb3IoIHZhciBpID0gMDsgaSA8IHBlcmNlbnREZW1hbmRzLmxlbmd0aDsgaSsrICkge1xuICAgIHRtcCArPSBwZXJjZW50RGVtYW5kc1tpXTtcbiAgfVxuICBpZiggcGVyY2VudERlbWFuZHMubGVuZ3RoID4gMCApIGF2Z1ByZWNlbnREZW1hbmQgPSB0bXAgLyBwZXJjZW50RGVtYW5kcy5sZW5ndGg7XG5cbiAgdmFyIGxheWVyID0gTC5nZW9Kc29uKFxuICAgIGh1Y0NhY2hlW2lkXSxcbiAgICB7XG4gICAgICBzdHlsZTogZnVuY3Rpb24oZmVhdHVyZSkge1xuICAgICAgICByZXR1cm4gbWFya2VyQ29uZmlnLnBlcmNlbnREZW1hbmRIdWMoYXZnUHJlY2VudERlbWFuZCk7XG4gICAgICB9XG4gICAgfVxuICApLmFkZFRvKG1hcCk7XG5cbiAgbGF5ZXJzLnB1c2gobGF5ZXIpO1xufVxuXG5mdW5jdGlvbiBnZXRDYWNoZSgpIHtcbiAgcmV0dXJuIGh1Y0NhY2hlO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgaW5pdCA6IGluaXQsXG4gIHJlbmRlciA6IHJlbmRlcixcbiAgY2xlYXIgOiBjbGVhcixcbiAgZ2V0Q2FjaGUgOiBnZXRDYWNoZVxufTtcbiIsInJlcXVpcmUoJy4vbGVhZmxldCcpOyAvLyBpbXBvcnQgY3VzdG9tIG1hcmtlcnMgdG8gbGVhZmxldCBuYW1lc3BhY2UgKGdsb2JhbClcbnZhciBtYXAgPSByZXF1aXJlKCcuL21hcCcpO1xudmFyIGh1YyA9IHJlcXVpcmUoJy4vaHVjJyk7XG52YXIgZmlsZSA9IHJlcXVpcmUoJy4vZmlsZScpO1xudmFyIGRpcmVjdG9yeSA9IHJlcXVpcmUoJy4vbGlicmFyeScpO1xudmFyIGRhdGFzdG9yZSA9IHJlcXVpcmUoJy4vZGF0YXN0b3JlJyk7XG5cblxudmFyIG1hcCwgZ2VvSnNvbkxheWVyO1xudmFyIHdtc0xheWVycyA9IFtdO1xudmFyIGFsbERhdGEgPSBbXTtcblxuLy8gc2hvdWxkIGJlIGZpbGxlZCBvciBlbXB0eTtcbnZhciByZW5kZXJEZW1hbmQgPSAnZW1wdHknO1xudmFyIGN1cnJlbnRQb2ludHMgPSBudWxsO1xudmFyIGxhc3RSZXNwUG9pbnRzID0gbnVsbDtcblxuJChkb2N1bWVudCkub24oJ3JlYWR5JywgZnVuY3Rpb24oKXtcbiAgcmVzaXplKCk7XG4gIGluaXQoKTtcbn0pO1xuXG4kKHdpbmRvdylcbiAgLm9uKCdyZXNpemUnLCByZXNpemUpO1xuXG5mdW5jdGlvbiBpbml0KCkge1xuICB2YXIgY29uZmlnID0ge1xuICAgIGRhdGFzdG9yZSA6IGRhdGFzdG9yZSxcbiAgICBtYXAgOiBtYXAsXG4gICAgaHVjIDogaHVjXG4gIH07XG5cbiAgbWFwLmluaXQoY29uZmlnKTtcbiAgaHVjLmluaXQoY29uZmlnKTtcbiAgZmlsZS5pbml0KGNvbmZpZyk7XG4gIGRpcmVjdG9yeS5pbml0KGNvbmZpZyk7XG5cbiAgLy8gcXVpY2tseSBsb2FkcyAvdGVzdGRhdGEvU2FjUml2ZXIuY3N2IGZvciB0ZXN0aW5nXG4gIC8vIHJlcXVpcmUoJy4vdGVzdCcpKGZpbGUpO1xufVxuXG5mdW5jdGlvbiByZXNpemUoKSB7XG4gIHZhciBoID0gd2luZG93LmlubmVySGVpZ2h0O1xuICB2YXIgdyA9IHdpbmRvdy5pbm5lcldpZHRoO1xuICBpZiggaCA9PT0gbnVsbCApIGggPSAkKHdpbmRvdykuaGVpZ2h0KCk7XG4gIGlmKCB3ID09PSBudWxsICkgdyA9ICQod2luZG93KS53aWR0aCgpO1xuXG4gICQoJyNtYXAnKS5oZWlnaHQoaCkud2lkdGgodyk7XG4gICQoJyNpbmZvJykuY3NzKCdtYXgtaGVpZ2h0JywgKGgtODUpKydweCcpO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgbWFwIDogbWFwLFxuICBodWMgOiBodWMsXG4gIGZpbGUgOiBmaWxlLFxuICBkaXJlY3RvcnkgOiBkaXJlY3RvcnksXG4gIGRzIDogZGF0YXN0b3JlXG59O1xuIiwidmFyIEljb25SZW5kZXJlciA9IHJlcXVpcmUoJy4uL21hcmtlcnMvaWNvblJlbmRlcmVyJyk7XG5cbkwuSWNvbi5DYW52YXMgPSBMLkljb24uZXh0ZW5kKHtcbiAgICBvcHRpb25zOiB7XG4gICAgICAgIGljb25TaXplOiBuZXcgTC5Qb2ludCgyMCwgMjApLCAvLyBIYXZlIHRvIGJlIHN1cHBsaWVkXG4gICAgICAgIGNsYXNzTmFtZTogJ2xlYWZsZXQtY2FudmFzLWljb24nXG4gICAgfSxcblxuICAgIGNyZWF0ZUljb246IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdjYW52YXMnKTtcbiAgICAgICAgdGhpcy5fc2V0SWNvblN0eWxlcyhlLCAnaWNvbicpO1xuXG4gICAgICAgIGUud2lkdGggPSB0aGlzLm9wdGlvbnMud2lkdGg7XG4gICAgICAgIGUuaGVpZ2h0ID0gdGhpcy5vcHRpb25zLmhlaWdodDtcblxuICAgICAgICBlLnN0eWxlLm1hcmdpblRvcCA9ICgtMSp0aGlzLm9wdGlvbnMud2lkdGgvMikrJ3B4JztcbiAgICAgICAgZS5zdHlsZS5tYXJnaW5MZWZ0ID0gKC0xKnRoaXMub3B0aW9ucy5oZWlnaHQvMikrJ3B4JztcblxuICAgICAgICBlLnN0eWxlLndpZHRoID0gdGhpcy5vcHRpb25zLndpZHRoKydweCc7XG4gICAgICAgIGUuc3R5bGUuaGVpZ2h0ID10aGlzLm9wdGlvbnMuaGVpZ2h0KydweCc7XG5cbiAgICAgICAgdGhpcy5kcmF3KGUuZ2V0Q29udGV4dCgnMmQnKSk7XG5cbiAgICAgICAgcmV0dXJuIGU7XG4gICAgfSxcblxuICAgIGNyZWF0ZVNoYWRvdzogZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9LFxuXG5cbiAgICBkcmF3OiBmdW5jdGlvbihjdHgpIHtcbiAgICAgIEljb25SZW5kZXJlcihjdHgsIHRoaXMub3B0aW9ucyk7XG4gICAgfVxufSk7XG4iLCJ2YXIgbWFya2VyQ29uZmlnID0gcmVxdWlyZSgnLi4vbWFya2Vycy9jb25maWcnKTtcbnZhciBJY29uUmVuZGVyZXIgPSByZXF1aXJlKCcuLi9tYXJrZXJzL2ljb25SZW5kZXJlcicpO1xudmFyIG1hcmtlcnMgPSBtYXJrZXJDb25maWcuZGVmYXVsdHM7XG5cblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihwb2ludCkge1xuXG4gIHZhciB0eXBlID0gcG9pbnQucHJvcGVydGllcy5yaXBhcmlhbiA/ICdyaXBhcmlhbicgOiAnYXBwbGljYXRpb24nO1xuICB2YXIgYWxsb2NhdGlvbiA9ICd1bmFsbG9jYXRlZCc7XG5cbiAgZm9yKCB2YXIgaSA9IDA7IGkgPCBwb2ludC5wcm9wZXJ0aWVzLmFsbG9jYXRpb25zLmxlbmd0aDsgaSsrICkge1xuICAgIGlmKCBwb2ludC5wcm9wZXJ0aWVzLmFsbG9jYXRpb25zW2ldLmFsbG9jYXRpb24gPiAwICkgYWxsb2NhdGlvbiA9ICdhbGxvY2F0ZWQnO1xuICB9XG5cbiAgdmFyIG9wdGlvbnMgPSAkLmV4dGVuZCh0cnVlLCB7fSwgbWFya2Vyc1t0eXBlXVthbGxvY2F0aW9uXSk7XG5cbiAgaWYoIHBvaW50LnByb3BlcnRpZXMuYWxsb2NhdGlvbnMgJiYgcG9pbnQucHJvcGVydGllcy5hbGxvY2F0aW9ucy5sZW5ndGggPiAwICkge1xuXG4gICAgdmFyIGRlbWFuZCA9IHBvaW50LnByb3BlcnRpZXMuYWxsb2NhdGlvbnNbMF0uZGVtYW5kO1xuICAgIGFsbG9jYXRpb24gPSBwb2ludC5wcm9wZXJ0aWVzLmFsbG9jYXRpb25zWzBdLmFsbG9jYXRpb247XG5cbiAgICBpZiggZGVtYW5kID09PSAwICkge1xuXG4gICAgICAkLmV4dGVuZCh0cnVlLCBvcHRpb25zLCBtYXJrZXJzLm5vRGVtYW5kKTtcbiAgICAgIHBvaW50LnByb3BlcnRpZXMubm9EZW1hbmQgPSB0cnVlO1xuXG4gICAgfSBlbHNlIHtcbiAgICAgIG1hcmtlckNvbmZpZy5wZXJjZW50RGVtYW5kKG9wdGlvbnMsIGFsbG9jYXRpb24gLyBkZW1hbmQpO1xuXG4gICAgICB2YXIgc2l6ZSA9IE1hdGguc3FydChkZW1hbmQpICogMztcbiAgICAgIGlmKCBzaXplID4gNTAgKSBzaXplID0gNTA7XG4gICAgICBpZiggc2l6ZSA8IDcgKSBzaXplID0gNztcblxuICAgICAgb3B0aW9ucy5oZWlnaHQgPSBzaXplKjI7XG4gICAgICBvcHRpb25zLndpZHRoID0gc2l6ZSoyO1xuICAgIH1cbiAgfVxuXG4gIHZhciBtYXJrZXI7XG4gIHZhciBkID0gMTk3MTtcbiAgdHJ5IHtcbiAgICBpZiggdHlwZW9mIHBvaW50LnByb3BlcnRpZXMucHJpb3JpdHlfZGF0ZSA9PT0gJ3N0cmluZycgKSB7XG4gICAgICBkID0gcG9pbnQucHJvcGVydGllcy5wcmlvcml0eV9kYXRlID8gcGFyc2VJbnQocG9pbnQucHJvcGVydGllcy5wcmlvcml0eV9kYXRlLnJlcGxhY2UoLy0uKi8sJycpKSA6IDIwMDA7XG4gICAgfSBlbHNlIGlmICggdHlwZW9mIHBvaW50LnByb3BlcnRpZXMucHJpb3JpdHlfZGF0ZSA9PT0gJ29iamVjdCcpIHtcbiAgICAgIGQgPSBwb2ludC5wcm9wZXJ0aWVzLnByaW9yaXR5X2RhdGUuZ2V0WWVhcigpKzE5MDA7XG4gICAgfVxuICB9IGNhdGNoKGUpIHtcbiAgICBkID0gMTk3MTtcbiAgfVxuXG5cblxuICBpZiggcG9pbnQucHJvcGVydGllcy5yaXBhcmlhbiApIHtcbiAgICBwb2ludC5wcm9wZXJ0aWVzLl9yZW5kZXJlZF9hcyA9ICdSaXBhcmlhbic7XG4gICAgb3B0aW9ucy5zaWRlcyA9IDA7XG4gICAgLy9tYXJrZXIgPSBMLmR3cmF0TWFya2VyKGxhdGxuZywgb3B0aW9ucyk7XG4gIH0gZWxzZSBpZiAoIGQgPCAxOTE0ICkge1xuICAgIHBvaW50LnByb3BlcnRpZXMuX3JlbmRlcmVkX2FzID0gJ1ByZS0xOTE0IEFwcHJvcHJpYXRpdmUnO1xuICAgIG9wdGlvbnMuc2lkZXMgPSAzO1xuICAgIG9wdGlvbnMucm90YXRlID0gOTA7XG4gICAgLy9tYXJrZXIgPSBMLmR3cmF0TWFya2VyKGxhdGxuZywgb3B0aW9ucyk7XG4gIH0gZWxzZSB7XG4gICAgcG9pbnQucHJvcGVydGllcy5fcmVuZGVyZWRfYXMgPSAnUG9zdC0xOTE0IEFwcHJvcHJpYXRpdmUnO1xuICAgIC8vbWFya2VyID0gTC5kd3JhdE1hcmtlcihsYXRsbmcsIG9wdGlvbnMpO1xuICB9XG5cbiAgcG9pbnQucHJvcGVydGllcy5fcmVuZGVyID0gb3B0aW9ucztcblxuICByZXR1cm4ge1xuICAgICAgZ2VvanNvbiA6IHBvaW50LFxuICAgICAgc2l6ZSA6IG9wdGlvbnMud2lkdGgvMixcbiAgICAgIHJlbmRlciA6IHJlbmRlclxuICB9O1xufTtcblxuZnVuY3Rpb24gcmVuZGVyKGN0eCwgeHlQb2ludHMsIG1hcCkge1xuICBJY29uUmVuZGVyZXIoY3R4LCB0aGlzLmdlb2pzb24ucHJvcGVydGllcy5fcmVuZGVyLCB4eVBvaW50cyk7XG59XG4iLCJ2YXIgSWNvblJlbmRlcmVyID0gcmVxdWlyZSgnLi4vbWFya2Vycy9pY29uUmVuZGVyZXInKTtcblxuTC5kd3JhdE1hcmtlciA9IGZ1bmN0aW9uIChsYXRsbmcsIG9wdGlvbnMpIHtcbiAgdmFyIG1hcmtlciA9IG5ldyBMLk1hcmtlcihsYXRsbmcsIHtcbiAgICAgIGljb246IG5ldyBMLkljb24uQ2FudmFzKG9wdGlvbnMpLFxuICAgICAgaWNvblNpemU6IG5ldyBMLlBvaW50KG9wdGlvbnMud2lkdGgsIG9wdGlvbnMuaGVpZ2h0KSxcbiAgfSk7XG5cbiAgbWFya2VyLnNldFN0eWxlID0gZnVuY3Rpb24ob3B0aW9ucykge1xuICAgIHZhciBvID0gdGhpcy5vcHRpb25zLmljb24ub3B0aW9ucztcblxuICAgICQuZXh0ZW5kKHRydWUsIG8sIG9wdGlvbnMpO1xuICAgIGlmKCAhdGhpcy5faWNvbiApIHJldHVybjtcblxuICAgIHZhciBjdHggPSB0aGlzLl9pY29uLmdldENvbnRleHQoJzJkJyk7XG4gICAgY3R4LmNsZWFyUmVjdCgwLCAwLCBvLndpZHRoLCBvLmhlaWdodCk7XG5cbiAgICBJY29uUmVuZGVyZXIoY3R4LCBvKTtcbiAgfTtcblxuICByZXR1cm4gbWFya2VyO1xufTtcbiIsInJlcXVpcmUoJy4vY2FudmFzJyk7XG5yZXF1aXJlKCcuL2R3cmF0Jyk7XG5yZXF1aXJlKCcuLi8uLi8uLi9ub2RlX21vZHVsZXMvbGVhZmxldC1jYW52YXMtZ2VvanNvbi9zcmMvbGF5ZXIuanMnKTtcbiIsInZhciBEcm91Z2h0SWNvbiA9IHJlcXVpcmUoJy4uL21hcmtlcnMvZHJvdWdodEljb24nKTtcbnZhciBtYXJrZXJDb25maWcgPSByZXF1aXJlKCcuLi9tYXJrZXJzL2NvbmZpZycpO1xudmFyIG1hcmtlclRlbXBsYXRlID0gcmVxdWlyZSgnLi90ZW1wbGF0ZScpO1xudmFyIG1hcmtlcnMgPSBtYXJrZXJDb25maWcuZGVmYXVsdHM7XG52YXIgbWFwLCBkYXRhc3RvcmU7XG5cbmdsb2JhbC5zZXR0aW5ncyA9IHtcbiAgcmVuZGVyRGVtYW5kIDogJ2VtcHR5J1xufTtcblxubW9kdWxlLmV4cG9ydHMuaW5pdCA9IGZ1bmN0aW9uKGNvbmZpZykge1xuICBtYXAgPSBjb25maWcubWFwO1xuICBkYXRhc3RvcmUgPSBjb25maWcuZGF0YXN0b3JlO1xuXG4gIHZhciBkZW1hbmRTdGVwcyA9IFswLCAxLCA1MCwgMTAwLCAyNTBdO1xuXG4gIHZhciBvcHRpb25zID0gJC5leHRlbmQodHJ1ZSwge30sIG1hcmtlcnMucmlwYXJpYW4udW5hbGxvY2F0ZWQpO1xuICBvcHRpb25zLnNpZGVzID0gMDtcbiAgdmFyIGljb24gPSBuZXcgRHJvdWdodEljb24ob3B0aW9ucyk7XG4gICQoJyNsZWdlbmQtcmlwYXJpYW4nKS5hcHBlbmQoJChpY29uLmVsZSkpO1xuXG5cbiAgb3B0aW9ucyA9ICQuZXh0ZW5kKHRydWUsIHt9LCBtYXJrZXJzLmFwcGxpY2F0aW9uLnVuYWxsb2NhdGVkKTtcbiAgb3B0aW9ucy5zaWRlcyA9IDM7XG4gIG9wdGlvbnMucm90YXRlID0gOTA7XG4gIGljb24gPSBuZXcgRHJvdWdodEljb24ob3B0aW9ucyk7XG4gICQoJyNsZWdlbmQtcHJlLWFwcHJvcHJpYXRpdmUnKS5hcHBlbmQoJChpY29uLmVsZSkpO1xuXG4gIGljb24gPSBuZXcgRHJvdWdodEljb24obWFya2Vycy5hcHBsaWNhdGlvbi51bmFsbG9jYXRlZCk7XG4gICQoJyNsZWdlbmQtcG9zdC1hcHByb3ByaWF0aXZlJykuYXBwZW5kKCQoaWNvbi5lbGUpKTtcblxuICB2YXIgdGFibGUgPSAnPHRhYmxlIHN0eWxlPVwidGV4dC1hbGlnbjpjZW50ZXJcIj48dHIgc3R5bGU9XCJ2ZXJ0aWNhbC1hbGlnbjogYm90dG9tXCI+JztcbiAgdmFyIGljb25zID0gW107XG4gIGZvciggdmFyIGkgPSAwOyBpIDwgZGVtYW5kU3RlcHMubGVuZ3RoOyBpKysgKSB7XG4gICAgdGFibGUgKz0gJzx0ZCBzdHlsZT1cInBhZGRpbmc6NHB4XCI+PGRpdiBpZD1cImxlZ2VuZC1kZW1hbmQtJytpKydcIj48L2Rpdj48ZGl2PicrXG4gICAgICAgICAgICAgIChkZW1hbmRTdGVwc1tpXSA9PSAxID8gJzwnIDogJycpICtcbiAgICAgICAgICAgICAgKGRlbWFuZFN0ZXBzW2ldID09IDI1MCA/ICc+JyA6ICcnKSArXG4gICAgICAgICAgICAgIGRlbWFuZFN0ZXBzW2ldKyc8L2Rpdj48L3RkPic7XG5cblxuICAgIGlmKCBkZW1hbmRTdGVwc1tpXSA9PT0gMCApIHtcbiAgICAgIG9wdGlvbnMgPSAkLmV4dGVuZCh0cnVlLCB7fSwgbWFya2Vycy5hcHBsaWNhdGlvbi51bmFsbG9jYXRlZCk7XG4gICAgICBvcHRpb25zID0gJC5leHRlbmQodHJ1ZSwgb3B0aW9ucywgbWFya2Vycy5ub0RlbWFuZCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIG9wdGlvbnMgPSAkLmV4dGVuZCh0cnVlLCB7fSwgbWFya2Vycy5hcHBsaWNhdGlvbi51bmFsbG9jYXRlZCk7XG5cbiAgICAgIHZhciBzaXplID0gTWF0aC5zcXJ0KGRlbWFuZFN0ZXBzW2ldKSAqIDM7XG4gICAgICBpZiggc2l6ZSA+IDUwICkgc2l6ZSA9IDUwO1xuICAgICAgaWYoIHNpemUgPCA3ICkgc2l6ZSA9IDc7XG5cbiAgICAgIG9wdGlvbnMuaGVpZ2h0ID0gKHNpemUqMikrMjtcbiAgICAgIG9wdGlvbnMud2lkdGggPSAoc2l6ZSoyKSsyO1xuICAgIH1cblxuICAgIGljb25zLnB1c2gobmV3IERyb3VnaHRJY29uKG9wdGlvbnMpKTtcbiAgfVxuICAkKCcjbGVnZW5kLWRlbWFuZCcpLmh0bWwodGFibGUrJzwvdHI+PC90YWJsZT4nKTtcblxuICBmb3IoIGkgPSAwOyBpIDwgaWNvbnMubGVuZ3RoOyBpKysgKSB7XG4gICAgJCgnI2xlZ2VuZC1kZW1hbmQtJytpKS5hcHBlbmQoJChpY29uc1tpXS5lbGUpKTtcbiAgfVxuXG4gIHRoaXMucmVkcmF3UERlbWFuZExlZ2VuZCgpO1xuXG4gIC8vIGluaXQgdG9nZ2xlIGJ1dHRvblxuXG4gICQoJyNsZWdlbmRUb2dnbGUnKS5vbignY2xpY2snLCBmdW5jdGlvbigpe1xuICAgIGlmKCB0aGlzLmhhc0F0dHJpYnV0ZSgnc2hvd2luZycpICkge1xuICAgICAgdGhpcy5yZW1vdmVBdHRyaWJ1dGUoJ3Nob3dpbmcnKTtcbiAgICAgICQoJyNsZWdlbmQnKS5oaWRlKCdzbG93Jyk7XG4gICAgICB0aGlzLmlubmVySFRNTCA9ICc8aSBjbGFzcz1cImZhIGZhLWFycm93LXJpZ2h0XCI+PC9pPic7XG5cbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5zZXRBdHRyaWJ1dGUoJ3Nob3dpbmcnLCAnJyk7XG4gICAgICAkKCcjbGVnZW5kJykuc2hvdygnc2xvdycpO1xuICAgICAgdGhpcy5pbm5lckhUTUwgPSAnPGkgY2xhc3M9XCJmYSBmYS1hcnJvdy1kb3duXCI+PC9pPic7XG4gICAgfVxuICB9KTtcblxuICAkKCcjcmVuZGVyVHlwZUZpbGxlZCcpLm9uKCdjbGljaycsIG9uUmVuZGVyVHlwZUNoYW5nZSk7XG4gICQoJyNyZW5kZXJUeXBlRW1wdHknKS5vbignY2xpY2snLCBvblJlbmRlclR5cGVDaGFuZ2UpO1xuXG4gICQoJyNzaG93Tm9EZW1hbmQnKS5vbignY2xpY2snLCBmdW5jdGlvbigpe1xuICAgIG1hcC5nZW9qc29uLmNsZWFyTGF5ZXIoKTtcbiAgICB2YXIgbm9EZW1hbmQgPSAhJCh0aGlzKS5pcygnOmNoZWNrZWQnKTtcbiAgICBtYXAuZ2VvanNvbi5hZGQoZGF0YXN0b3JlLmdldChub0RlbWFuZCkpO1xuICB9KTtcbn07XG5cbmZ1bmN0aW9uIHJlZHJhd1BEZW1hbmRMZWdlbmQoKSB7XG4gIHZhciBwZXJjZW50U3RlcHMgPSBbMCwgMjUsIDUwLCA3NSwgMTAwXSwgaTtcblxuICB2YXIgdGFibGUgPSAnPHRhYmxlIHN0eWxlPVwidGV4dC1hbGlnbjpjZW50ZXJcIj48dHIgc3R5bGU9XCJ2ZXJ0aWNhbC1hbGlnbjogYm90dG9tXCI+JztcbiAgdmFyIGljb25zID0gW107XG5cdGZvciggaSA9IDA7IGkgPCBwZXJjZW50U3RlcHMubGVuZ3RoOyBpKysgKSB7XG5cdFx0dGFibGUgKz0gJzx0ZCBzdHlsZT1cInBhZGRpbmc6OHB4XCI+PGRpdiBpZD1cImxlZ2VuZC1wcmVjZW50LW9mLWRlbWFuZC0nK2krJ1wiPjwvZGl2PjxkaXY+Jytcblx0XHRcdFx0XHRwZXJjZW50U3RlcHNbaV0rJyU8L2Rpdj48L3RkPic7XG5cblx0XHR2YXIgb3B0aW9ucyA9ICQuZXh0ZW5kKHRydWUsIHt9LCBtYXJrZXJzLmFwcGxpY2F0aW9uLnVuYWxsb2NhdGVkKTtcblxuICAgIG1hcmtlckNvbmZpZy5wZXJjZW50RGVtYW5kKG9wdGlvbnMsIHBlcmNlbnRTdGVwc1tpXSAvIDEwMCk7XG5cblx0XHRpY29ucy5wdXNoKG5ldyBEcm91Z2h0SWNvbihvcHRpb25zKSk7XG5cdH1cblx0JCgnI2xlZ2VuZC1wcmVjZW50LW9mLWRlbWFuZCcpLmh0bWwodGFibGUrJzwvdHI+PC90YWJsZT4nKTtcblxuXHRmb3IoIGkgPSAwOyBpIDwgaWNvbnMubGVuZ3RoOyBpKysgKSB7XG5cdFx0JCgnI2xlZ2VuZC1wcmVjZW50LW9mLWRlbWFuZC0nK2kpLmFwcGVuZCgkKGljb25zW2ldLmVsZSkpO1xuXHR9XG59O1xubW9kdWxlLmV4cG9ydHMucmVkcmF3UERlbWFuZExlZ2VuZCA9IHJlZHJhd1BEZW1hbmRMZWdlbmQ7XG5cbmZ1bmN0aW9uIG9uUmVuZGVyVHlwZUNoYW5nZSgpIHtcbiAgdmFyIHNldHRpbmdzID0gZ2xvYmFsLnNldHRpbmdzO1xuICB2YXIgaXNGaWxsZWRDaGVja2VkID0gJCgnI3JlbmRlclR5cGVGaWxsZWQnKS5pcygnOmNoZWNrZWQnKTtcbiAgdmFyIG5ld1ZhbCA9IGlzRmlsbGVkQ2hlY2tlZCA/ICdmaWxsZWQnIDogJ2VtcHR5JztcblxuICBpZiggc2V0dGluZ3MucmVuZGVyRGVtYW5kID09IG5ld1ZhbCApIHJldHVybjtcbiAgc2V0dGluZ3MucmVuZGVyRGVtYW5kID0gbmV3VmFsO1xuXG4gIC8vIHJlbmRlciBsZWdlbmRcbiAgcmVkcmF3UERlbWFuZExlZ2VuZCgpO1xuXG4gIGlmKCAhY3VycmVudFBvaW50cyApIHJldHVybjtcblxuICBtYXAuZ2VvanNvbi5jbGVhckxheWVyKCk7XG4gIHZhciBub0RlbWFuZCA9ICEkKHRoaXMpLmlzKCc6Y2hlY2tlZCcpO1xuICBtYXAuZ2VvanNvbi5hZGQoZGF0YXN0b3JlLmdldChub0RlbWFuZCkpO1xufVxuXG5tb2R1bGUuZXhwb3J0cy5zdGFtcCA9IGZ1bmN0aW9uKGRhdGEpIHtcbiAgdmFyIHRlbXBsYXRlID0gbWFya2VyVGVtcGxhdGU7XG4gIGZvciggdmFyIGtleSBpbiBkYXRhICkgdGVtcGxhdGUgPSB0ZW1wbGF0ZS5yZXBsYWNlKCd7eycra2V5Kyd9fScsIGRhdGFba2V5XSk7XG4gIHJldHVybiB0ZW1wbGF0ZTtcbn07XG4iLCJtb2R1bGUuZXhwb3J0cyA9IFxuICAnPGRpdiBjbGFzcz1cInNwYWNlclwiPjwvZGl2PicrXG4gICc8aDM+V2F0ZXIgUmlnaHQvQ2xhaW0gIzoge3thcHBsaWNhdGlvbl9udW1iZXJ9fTwvaDM+JytcbiAgJzxkaXYgc3R5bGU9XCJtYXJnaW46MTVweFwiPicrXG4gICAgJzxiPkZvcjo8L2I+IHt7ZGF0ZX19PGJyIC8+JytcbiAgICAnPGI+QWxsb2NhdGlvbjo8L2I+IHt7YWxsb2NhdGlvbn19IFtBYy1mdC9kYXldPGJyIC8+JytcbiAgICAnPGI+RGVtYW5kOjwvYj4ge3tkZW1hbmR9fSBbQWMtZnQvZGF5XScrXG4gICAgJzxiciAvPjxiPlBlcmNlbnQgb2YgRGVtYW5kOiA8L2I+e3tyYXRpb319JTxiciAvPicrXG4gICAgJzxkaXYgY2xhc3M9XCJ3ZWxsIHdlbGwtc21cIiBzdHlsZT1cIm1hcmdpbi10b3A6NXB4XCI+JytcbiAgICAne3t3YXRlcl9yaWdodF90eXBlfX08YnIgLz4nK1xuICAgICc8Yj5Qcmlvcml0eSBEYXRlOjwvYj4ge3twcmlvcml0eV9kYXRlfX0nK1xuICAgICc8L2Rpdj4nK1xuICAnPC9kaXY+JztcbiIsInZhciBmaWxlcyA9IFtdO1xuXG52YXIgcm9vdCA9ICdodHRwczovL2RvY3MuZ29vZ2xlLmNvbS9zcHJlYWRzaGVldHMvZC8xQUNpN1AwcE95LUpSanR3NkhyaWJRcGhoRU9aLTAtQ2tRX21xbnlDZkpjSS9ndml6L3RxJztcbnZhciBwb3B1cCwgYm9keSwgZmlsZSwgbWFwLCB0b2FzdDtcblxuZnVuY3Rpb24gaW5pdChjb25maWcpIHtcbiAgZmlsZSA9IGNvbmZpZy5maWxlO1xuICBtYXAgPSBjb25maWcubWFwO1xuXG4gIHZhciBxdWVyeSA9IG5ldyBnb29nbGUudmlzdWFsaXphdGlvbi5RdWVyeShyb290KTtcbiAgcXVlcnkuc2VuZChvbkluaXRMb2FkKTtcblxuICBwb3B1cCA9ICQoJyNkaXJlY3RvcnktbW9kYWwnKS5tb2RhbCh7c2hvdzogZmFsc2V9KTtcbiAgYm9keSA9ICQoJyNkaXJlY3RvcnktbW9kYWwtYm9keScpO1xuXG4gICQoJyNkaXJlY3RvcnktYnRuJykub24oJ2NsaWNrJywgZnVuY3Rpb24oKXtcbiAgICBwb3B1cC5tb2RhbCgnc2hvdycpO1xuICB9KTtcblxuICB0b2FzdCA9ICQoJzxkaXYgc3R5bGU9XCJkaXNwbGF5Om5vbmU7cG9zaXRpb246Zml4ZWQ7bGVmdDoxMHB4OyBib3R0b206IDUwcHhcIiBjbGFzcz1cImFuaW1hdGVkIGZhZGVJblVwXCIgaWQ9XCJ0b2FzdFwiPjxkaXYgY2xhc3M9XCJhbGVydCBhbGVydC1zdWNjZXNzXCI+PGkgY2xhc3M9XCJmYSBmYS1zcGlubmVyIGZhLXNwaW5cIj48L2k+IExvYWRpbmcgRmlsZS4uLjwvZGl2PjwvZGl2PicpO1xuICAkKCdib2R5JykuYXBwZW5kKHRvYXN0KTtcbn1cblxuZnVuY3Rpb24gb25Jbml0TG9hZChyZXNwKSB7XG4gIGlmIChyZXNwLmlzRXJyb3IoKSkge1xuICAgIGFsZXJ0KCdFcnJvciBpbiBsb2FkaW5nIHB1YmxpYyBkaXJlY3RvcnkgbGlzdGluZzogJyArIHJlc3BvbnNlLmdldE1lc3NhZ2UoKSArICcgJyArIHJlc3BvbnNlLmdldERldGFpbGVkTWVzc2FnZSgpKTtcbiAgICByZXR1cm47XG4gIH1cblxuICB2YXIgZGF0YSA9IHJlc3AuZ2V0RGF0YVRhYmxlKCk7XG4gIHZhciByb3dMZW4gPSBkYXRhLmdldE51bWJlck9mUm93cygpO1xuICB2YXIgY29sTGVuID0gZGF0YS5nZXROdW1iZXJPZkNvbHVtbnMoKTtcblxuICB2YXIgdGFibGUgPSAnPGg0PlNlbGVjdCBGaWxlIHRvIExvYWQ8L2g0Pjx0YWJsZSBjbGFzcz1cInRhYmxlXCI+JztcbiAgdGFibGUgKz0gJzx0cj48dGg+RmlsZW5hbWU8L3RoPjx0aD5TdGFydCBEYXRlPC90aD48dGg+RW5kIERhdGU8L3RoPjx0ZD48L3RkPjwvdHI+JztcbiAgZm9yKCB2YXIgaSA9IDA7IGkgPCByb3dMZW47IGkrKyApIHtcbiAgICB2YXIgZmlsZSA9IHt9O1xuICAgIGZvciggdmFyIGogPSAwOyBqIDwgY29sTGVuOyBqKysgKSB7XG4gICAgICBmaWxlW2RhdGEuZ2V0Q29sdW1uTGFiZWwoaildID0gZGF0YS5nZXRWYWx1ZShpLCBqKTtcbiAgICB9XG5cbiAgICB0YWJsZSArPSBmaWxlVG9Sb3coZmlsZSwgaSk7XG5cbiAgICBmaWxlcy5wdXNoKGZpbGUpO1xuICB9XG5cbiAgYm9keVxuICAgIC5odG1sKHRhYmxlKyc8L3RhYmxlPicpXG4gICAgLmZpbmQoJ2FbaW5kZXhdJylcbiAgICAub24oJ2NsaWNrJywgZnVuY3Rpb24oKXtcbiAgICAgIHZhciBmaWxlID0gZmlsZXNbcGFyc2VJbnQoJCh0aGlzKS5hdHRyKCdpbmRleCcpKV07XG4gICAgICBsb2FkKGZpbGUuUmVnaW9uKycgJytnZXREYXRlcyhmaWxlKSwgZmlsZS5JRCk7XG4gICAgICBwb3B1cC5tb2RhbCgnaGlkZScpO1xuICAgIH0pO1xufVxuXG5mdW5jdGlvbiBnZXREYXRlcyhmaWxlKSB7XG4gIGlmKCAhZmlsZVsnU3RhcnQgRGF0ZSddIHx8ICFmaWxlWydFbmQgRGF0ZSddICkgcmV0dXJuICcnO1xuXG4gIHZhciB0eHQgPSAnKCc7XG4gIHR4dCArPSBmaWxlWydTdGFydCBEYXRlJ10gPyB0b0RhdGUoZmlsZVsnU3RhcnQgRGF0ZSddKSA6ICc/JztcbiAgdHh0ICs9ICcgLSAnO1xuICB0eHQgKz0gZmlsZVsnRW5kIERhdGUnXSA/IHRvRGF0ZShmaWxlWydFbmQgRGF0ZSddKSA6ICc/JztcbiAgcmV0dXJuIHR4dCArICcpJztcblxufVxuXG5mdW5jdGlvbiBsb2FkKG5hbWUsIGlkKSB7XG4gIHRvYXN0LnNob3coKTtcblxuICB2YXIgcXVlcnkgPSBuZXcgZ29vZ2xlLnZpc3VhbGl6YXRpb24uUXVlcnkoJ2h0dHBzOi8vZG9jcy5nb29nbGUuY29tL3NwcmVhZHNoZWV0cy9kLycraWQrJy9ndml6L3RxJyk7XG4gIHF1ZXJ5LnNlbmQoZnVuY3Rpb24ocmVzcCl7XG4gICAgaWYgKHJlc3AuaXNFcnJvcigpKSB7XG4gICAgICB0b2FzdC5oaWRlKCk7XG4gICAgICBhbGVydCgnRXJyb3IgaW4gbG9hZGluZyBwdWJsaWMgc2hlZXQ6ICcgKyByZXNwb25zZS5nZXRNZXNzYWdlKCkgKyAnICcgKyByZXNwb25zZS5nZXREZXRhaWxlZE1lc3NhZ2UoKSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdmFyIGRhdGEgPSByZXNwLmdldERhdGFUYWJsZSgpO1xuICAgIHZhciByb3dMZW4gPSBkYXRhLmdldE51bWJlck9mUm93cygpO1xuICAgIHZhciBjb2xMZW4gPSBkYXRhLmdldE51bWJlck9mQ29sdW1ucygpO1xuICAgIHZhciBjc3YgPSBbW11dO1xuXG5cbiAgICBmb3IoIHZhciBpID0gMDsgaSA8IGNvbExlbjsgaSsrICkge1xuICAgICAgY3N2WzBdLnB1c2goZGF0YS5nZXRDb2x1bW5MYWJlbChpKSk7XG4gICAgfVxuXG4gICAgZm9yKCB2YXIgaSA9IDA7IGkgPCByb3dMZW47IGkrKyApIHtcbiAgICAgIHZhciByb3cgPSBbXTtcbiAgICAgIGZvciggdmFyIGogPSAwOyBqIDwgY29sTGVuOyBqKysgKSB7XG4gICAgICAgIHJvdy5wdXNoKGRhdGEuZ2V0VmFsdWUoaSwgaikpO1xuICAgICAgfVxuICAgICAgY3N2LnB1c2gocm93KTtcbiAgICB9XG5cbiAgICBmaWxlLnByb2Nlc3Muc2V0RmlsZW5hbWUobmFtZSk7XG4gICAgZmlsZS5wcm9jZXNzLm9uRmlsZVBhcnNlZChudWxsLCBjc3YpO1xuICB9KTtcbn1cblxuZnVuY3Rpb24gZmlsZVRvUm93KGZpbGUsIGluZGV4KSB7XG4gIHJldHVybiAnPHRyPicgK1xuICAgICc8dGQ+PGEgY2xhc3M9XCJidG4gYnRuLWxpbmtcIiBpbmRleD1cIicraW5kZXgrJ1wiPjxpIGNsYXNzPVwiZmEgZmEtZG93bmxvYWRcIj48L2k+ICcrZmlsZS5SZWdpb24rJzwvYT48L3RkPicrXG4gICAgJzx0ZD4nK2dldERhdGUoZmlsZVsnU3RhcnQgRGF0ZSddKSsnPC90ZD4nK1xuICAgICc8dGQ+JytnZXREYXRlKGZpbGVbJ0VuZCBEYXRlJ10pKyc8L3RkPicrXG4gICAgJzx0ZD48YSBjbGFzcz1cImJ0biBidG4tbGlua1wiIGhyZWY9XCJodHRwczovL2RvY3MuZ29vZ2xlLmNvbS9zcHJlYWRzaGVldHMvZC8nK2ZpbGUuSUQrJ1wiIHRhcmdldD1cIl9ibGFua1wiPjxpIGNsYXNzPVwiZmEgZmEtdGFibGVcIj48L2k+PC9hPjwvdGQ+JytcbiAgJzwvdHI+Jztcbn1cblxuZnVuY3Rpb24gZ2V0RGF0ZShkKSB7XG4gIGlmKCAhZCApIHJldHVybiAnPyc7XG4gIHJldHVybiB0b0RhdGUoZCk7XG59XG5cbmZ1bmN0aW9uIHRvRGF0ZShkKSB7XG4gIHJldHVybiAoZC5nZXRZZWFyKCkrMTkwMCkrJy0nKyhkLmdldE1vbnRoKCkrMSkrJy0nK2QuZ2V0RGF0ZSgpO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgaW5pdCA6IGluaXRcbn07XG4iLCJ2YXIgbWFya2VyQ29uZmlnID0gcmVxdWlyZSgnLi4vbWFya2Vycy9jb25maWcnKTtcbnZhciBtYXJrZXJTZWxlY3RvciA9IHJlcXVpcmUoJy4uL21hcmtlcnMnKTtcbnZhciBjYW52YXNQb2ludEZlYXR1cmUgPSByZXF1aXJlKCcuLi9sZWFmbGV0L2NhbnZhc1BvaW50RmVhdHVyZScpO1xudmFyIG1hcmtlcnMgPSBtYXJrZXJDb25maWcuZGVmYXVsdHM7XG5cbnZhciBnZW9Kc29uTGF5ZXIsIG1hcmtlckxheWVyO1xudmFyIG1hcCwgaHVjLCBkYXRhc3RvcmUsIG1hcE1vZHVsZTtcblxuXG5tb2R1bGUuZXhwb3J0cy5pbml0ID0gZnVuY3Rpb24oY29uZmlnKSB7XG4gIG1hcE1vZHVsZSA9IGNvbmZpZy5tYXA7XG4gIG1hcCA9IGNvbmZpZy5tYXAuZ2V0TGVhZmxldCgpO1xuICBkYXRhc3RvcmUgPSBjb25maWcuZGF0YXN0b3JlO1xuICBodWMgPSBjb25maWcuaHVjO1xuXG4gIG1hcmtlckxheWVyID0gbmV3IEwuQ2FudmFzR2VvanNvbkxheWVyKHtcbiAgICAvKm9uTW91c2VPdmVyIDogZnVuY3Rpb24oZmVhdHVyZXMpIHtcbiAgICAgIG1hcmtlclNlbGVjdG9yLmhvdmVyKGZlYXR1cmVzKTtcbiAgICAgIHVwZGF0ZU1vdXNlKG1hcmtlckxheWVyLl9jb250YWluZXIsIG1hcmtlckxheWVyLmludGVyc2VjdExpc3QpO1xuICAgIH0sXG4gICAgb25Nb3VzZU91dCA6IGZ1bmN0aW9uKGZlYXR1cmVzKSB7XG4gICAgICBtYXJrZXJTZWxlY3Rvci5ub2hvdmVyKGZlYXR1cmVzKTtcbiAgICAgIHVwZGF0ZU1vdXNlKG1hcmtlckxheWVyLl9jb250YWluZXIsIG1hcmtlckxheWVyLmludGVyc2VjdExpc3QpO1xuICAgIH0sKi9cbiAgICBvbkNsaWNrIDogb25GZWF0dXJlc0NsaWNrZWRcbiAgfSk7XG5cbiAgbWFya2VyTGF5ZXIuYWRkVG8obWFwKTtcbiAgbWFya2VyU2VsZWN0b3IuaW5pdChtYXJrZXJMYXllcik7XG59O1xuXG5tb2R1bGUuZXhwb3J0cy5hZGQgPSBmdW5jdGlvbihwb2ludHMpIHtcbiAgdmFyIHNob3dOb0RlbWFuZCA9ICQoJyNzaG93Tm9EZW1hbmQnKS5pcygnOmNoZWNrZWQnKTtcbiAgZGF0YXN0b3JlLmNsZWFyRmVhdHVyZXMoKTtcblxuICBpZiggIXNob3dOb0RlbWFuZCApIHtcbiAgICB0bXAgPSBbXTtcbiAgICBmb3IoIHZhciBpID0gcG9pbnRzLmxlbmd0aC0xOyBpID49IDA7IGktLSApIHtcbiAgICAgIGlmKCBwb2ludHNbaV0ucHJvcGVydGllcy5hbGxvY2F0aW9ucyAmJiBwb2ludHNbaV0ucHJvcGVydGllcy5hbGxvY2F0aW9ucy5sZW5ndGggPiAwICkge1xuXG4gICAgICAgIHZhciBkZW1hbmQgPSBwb2ludHNbaV0ucHJvcGVydGllcy5hbGxvY2F0aW9uc1swXS5kZW1hbmQ7XG4gICAgICAgIGlmKCBkZW1hbmQgIT09IDAgKSB0bXAucHVzaChwb2ludHNbaV0pO1xuICAgICAgfVxuICAgIH1cbiAgICBwb2ludHMgPSB0bXA7XG4gIH1cblxuICBtYXJrZXJMYXllci5mZWF0dXJlcyA9IFtdO1xuICBwb2ludHMuZm9yRWFjaChmdW5jdGlvbihwb2ludCl7XG4gICAgbWFya2VyTGF5ZXIuYWRkRmVhdHVyZShjYW52YXNQb2ludEZlYXR1cmUocG9pbnQpKTtcbiAgfSk7XG4gIG1hcmtlckxheWVyLnJlbmRlcigpO1xuXG4gIGN1cnJlbnRQb2ludHMgPSBwb2ludHM7XG4gIGh1Yy5yZW5kZXIocG9pbnRzKTtcbn07XG5cbmZ1bmN0aW9uIHVwZGF0ZU1vdXNlKGNvbnRhaW5lciwgZmVhdHVyZXMpIHtcbiAgaWYoIGZlYXR1cmVzLmxlbmd0aCA+IDAgKSB7XG4gICAgY29udGFpbmVyLnN0eWxlLmN1cnNvciA9ICdwb2ludGVyJztcbiAgfSBlbHNlIHtcbiAgICBjb250YWluZXIuc3R5bGUuY3Vyc29yID0gJ21vdmUnO1xuICB9XG59XG5cbmZ1bmN0aW9uIG9uRmVhdHVyZXNDbGlja2VkKGZlYXR1cmVzKSB7XG4gIHZhciBodG1sID0gJyc7XG5cbiAgbWFya2VyU2VsZWN0b3Iuc2VsZWN0KGZlYXR1cmVzKTtcblxuICBmb3IoIHZhciBpID0gMDsgaSA8IGZlYXR1cmVzLmxlbmd0aDsgaSsrICkge1xuICAgIHZhciBwID0gZmVhdHVyZXNbaV0ucHJvcGVydGllcztcblxuICAgIGh0bWwgKz0gbWFwTW9kdWxlLmxlZ2VuZC5zdGFtcCh7XG4gICAgICBhcHBsaWNhdGlvbl9udW1iZXIgOiBwLmFwcGxpY2F0aW9uX251bWJlcixcbiAgICAgIGRhdGUgOiBnZXREYXRlKHAuYWxsb2NhdGlvbnNbMF0uZGF0ZSksXG4gICAgICBhbGxvY2F0aW9uIDogcC5hbGxvY2F0aW9uc1swXS5hbGxvY2F0aW9uLFxuICAgICAgZGVtYW5kIDogcC5hbGxvY2F0aW9uc1swXS5kZW1hbmQsXG4gICAgICByYXRpbyA6IHAuYWxsb2NhdGlvbnNbMF0ucmF0aW8gIT09IG51bGwgPyAocC5hbGxvY2F0aW9uc1swXS5yYXRpbyoxMDApLnRvRml4ZWQoMikgOiAnMTAwJyxcbiAgICAgIHdhdGVyX3JpZ2h0X3R5cGUgOiBwLl9yZW5kZXJlZF9hcyxcbiAgICAgIHByaW9yaXR5X2RhdGUgOiBnZXREYXRlKHAucHJpb3JpdHlfZGF0ZSlcbiAgICB9KTtcbiAgfVxuXG4gICQoJyNpbmZvLXJlc3VsdCcpLmh0bWwoaHRtbCk7XG4gICQoJyNpbmZvJykuYW5pbWF0ZSh7XG4gICAgc2Nyb2xsVG9wOiAkKCcuaW5mby1ib3gnKS5oZWlnaHQoKVxuICB9LCAzMDApO1xufVxuXG5mdW5jdGlvbiBnZXREYXRlKGQpIHtcbiAgaWYoIGQgPT09IHVuZGVmaW5lZCB8fCBkID09PSBudWxsKSByZXR1cm4gJ1Vua25vd24nO1xuICBpZiggdHlwZW9mIGQgPT09ICdzdHJpbmcnICkgcmV0dXJuIGQ7XG4gIHJldHVybiBkLnRvRGF0ZVN0cmluZygpO1xufVxuXG5tb2R1bGUuZXhwb3J0cy5jbGVhckxheWVyID0gZnVuY3Rpb24oKSB7XG4gIC8vaWYoIGdlb0pzb25MYXllciApIG1hcC5yZW1vdmVMYXllcihnZW9Kc29uTGF5ZXIpO1xuICBtYXJrZXJMYXllci5mZWF0dXJlcyA9IFtdO1xuICBtYXJrZXJMYXllci5yZW5kZXIoKTtcbn07XG4iLCJ2YXIgbWFwO1xudmFyIGJhc2VNYXBzID0ge307XG52YXIgb3ZlcmxheU1hcHMgPSB7fTtcblxudmFyIGdlb2pzb24gPSByZXF1aXJlKCcuL2dlb2pzb24nKTtcbnZhciBnZW9qc29uTGF5ZXIgPSB7fTtcblxudmFyIGN1cnJlbnRQb2ludHMgPSBudWxsO1xudmFyIGN1cnJlbnRHZW9qc29uID0gbnVsbDtcblxubW9kdWxlLmV4cG9ydHMubGVnZW5kID0gcmVxdWlyZSgnLi4vbGVnZW5kJyk7XG5tb2R1bGUuZXhwb3J0cy5nZW9qc29uID0gcmVxdWlyZSgnLi9nZW9qc29uJyk7XG5cblxuXG5tb2R1bGUuZXhwb3J0cy5pbml0ID0gZnVuY3Rpb24ob3B0aW9ucykge1xuICBtYXAgPSBMLm1hcCgnbWFwJyx7dHJhY2tSZXNpemU6dHJ1ZX0pO1xuXG4gIC8vIGFkZCBhbiBPcGVuU3RyZWV0TWFwIHRpbGUgbGF5ZXJcbiAgTC50aWxlTGF5ZXIoJ2h0dHA6Ly97c30udGlsZS5vc20ub3JnL3t6fS97eH0ve3l9LnBuZycsIHtcbiAgICAgIGF0dHJpYnV0aW9uOiAnJmNvcHk7IDxhIGhyZWY9XCJodHRwOi8vb3NtLm9yZy9jb3B5cmlnaHRcIj5PcGVuU3RyZWV0TWFwPC9hPiBjb250cmlidXRvcnMnXG4gIH0pLmFkZFRvKG1hcCk7XG5cbiAgdmFyIHdtczEgPSBMLnRpbGVMYXllci53bXMoXCJodHRwczovL21hcHNlbmdpbmUuZ29vZ2xlLmNvbS8xNTU0MjYwMDczNDI3NTU0OTQ0NC0xMTg1MzY2NzI3MzEzMTU1MDM0Ni00L3dtcy8/dmVyc2lvbj0xLjMuMFwiLCB7XG4gICAgICBsYXllcnM6ICcxNTU0MjYwMDczNDI3NTU0OTQ0NC0wODExMjk3NDY5MDk5MTE2NDU4Ny00JyxcbiAgICAgIGZvcm1hdDogJ2ltYWdlL3BuZycsXG4gICAgICB0cmFuc3BhcmVudDogdHJ1ZSxcbiAgICAgIGF0dHJpYnV0aW9uOiBcIlwiLFxuICAgICAgYm91bmRzIDogTC5sYXRMbmdCb3VuZHMoXG4gICAgICAgIEwubGF0TG5nKDQyLjAwOTQzMTk4ODA0MDU4LCAtMTE0LjEzMDc1OTcyMTM0MDcpLFxuICAgICAgICBMLmxhdExuZygzMi41MzQyNjM0NTM2NzQ5MywgLTEyNC40MDk3MTE3MTY3ODI5OClcbiAgICAgIClcbiAgfSkuYWRkVG8obWFwKTtcblxuICAvKnZhciB3bXMyID0gTC50aWxlTGF5ZXIud21zKFwiaHR0cHM6Ly9tYXBzZW5naW5lLmdvb2dsZS5jb20vMTU1NDI2MDA3MzQyNzU1NDk0NDQtMTE4NTM2NjcyNzMxMzE1NTAzNDYtNC93bXMvP3ZlcnNpb249MS4zLjBcIiwge1xuICAgICAgbGF5ZXJzOiAnMTU1NDI2MDA3MzQyNzU1NDk0NDQtMTYxNDMxNTg2ODk2MDMzNjEwOTMtNCcsXG4gICAgICBmb3JtYXQ6ICdpbWFnZS9wbmcnLFxuICAgICAgdHJhbnNwYXJlbnQ6IHRydWUsXG4gICAgICBhdHRyaWJ1dGlvbjogXCJcIixcbiAgICAgIGJvdW5kcyA6IEwubGF0TG5nQm91bmRzKFxuICAgICAgICBMLmxhdExuZyg0Mi4wMDk0MzE5ODgwNDA1OCwgLTExNC4xMzA3NTk3MjEzNDA3KSxcbiAgICAgICAgTC5sYXRMbmcoMzIuNTM0MjYzNDUzNjc0OTMsIC0xMjQuNDA5NzExNzE2NzgyOTgpXG4gICAgICApXG4gIH0pOyovXG4gIHZhciB3bXMyID0gTC50aWxlTGF5ZXIud21zKFwiaHR0cDovL2F0bGFzLmN3cy51Y2RhdmlzLmVkdS9hcmNnaXMvc2VydmljZXMvV2F0ZXJzaGVkcy9NYXBTZXJ2ZXIvV01TU2VydmVyXCIsIHtcbiAgICAgIGxheWVyczogJzAnLFxuICAgICAgZm9ybWF0OiAnaW1hZ2UvcG5nJyxcbiAgICAgIHRyYW5zcGFyZW50OiB0cnVlLFxuICAgICAgYXR0cmlidXRpb246IFwiXCIsXG4gICAgICBib3VuZHMgOiBMLmxhdExuZ0JvdW5kcyhcbiAgICAgICAgTC5sYXRMbmcoNDMuMzUzMTQ0LCAtMTEzLjA1ODQ0MyksXG4gICAgICAgIEwubGF0TG5nKDMyLjA0NDUyOCwgLTEyNC43MTg2MzgpXG4gICAgICApXG4gIH0pO1xuXG4gIGJhc2VNYXBzID0ge307XG4gIG92ZXJsYXlNYXBzID0ge1xuICAgICdXYXRlcnNoZWRzJzogd21zMSxcbiAgICAnSFVDIDEyJzogd21zMlxuICB9O1xuXG4gIEwuY29udHJvbC5sYXllcnMoYmFzZU1hcHMsIG92ZXJsYXlNYXBzLCB7cG9zaXRpb246ICdib3R0b21sZWZ0J30pLmFkZFRvKG1hcCk7XG5cbiAgb3B0aW9ucy5tYXAgPSB0aGlzO1xuICBnZW9qc29uLmluaXQob3B0aW9ucyk7XG4gIHRoaXMubGVnZW5kLmluaXQob3B0aW9ucyk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cy5jbGVhckdlb2pzb25MYXllciA9IGZ1bmN0aW9uKCkge1xuICBnZW9qc29uLmNsZWFyTGF5ZXIoKTtcbn07XG5tb2R1bGUuZXhwb3J0cy5nZXRMZWFmbGV0ID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiBtYXA7XG59O1xuIiwidmFyIG1hcmtlcnMgPSB7XG4gIHJpcGFyaWFuIDoge1xuICAgIGFsbG9jYXRlZCA6IHtcbiAgICAgIGZpbGxDb2xvciAgIDogXCIjMjUyNUM5XCIsXG4gICAgICBjb2xvciAgICAgICA6IFwiIzMzMzMzM1wiLFxuICAgICAgd2VpZ2h0ICAgICAgOiAxLFxuICAgICAgb3BhY2l0eSAgICAgOiAxLFxuICAgICAgZmlsbE9wYWNpdHkgOiAwLjMsXG5cdFx0XHRzaWRlcyA6IDMsXG5cdFx0XHRyb3RhdGUgOiA5MCxcbiAgICAgIHdpZHRoOiAyMCxcbiAgICAgIGhlaWdodDogMjBcbiAgICB9LFxuICAgIHVuYWxsb2NhdGVkIDoge1xuICAgICAgZmlsbENvbG9yICAgOiBcIiNmZmZmZmZcIixcbiAgICAgIGNvbG9yICAgICAgIDogXCIjMzMzMzMzXCIsXG4gICAgICB3ZWlnaHQgICAgICA6IDEsXG4gICAgICBvcGFjaXR5ICAgICA6IDEsXG4gICAgICBmaWxsT3BhY2l0eSA6IDAuMyxcblx0XHRcdHNpZGVzIDogMyxcblx0XHRcdHJvdGF0ZSA6IDkwLFxuICAgICAgd2lkdGg6IDIwLFxuICAgICAgaGVpZ2h0OiAyMFxuICAgIH1cbiAgfSxcbiAgYXBwbGljYXRpb24gOiB7XG4gICAgYWxsb2NhdGVkIDoge1xuICAgICAgZmlsbENvbG9yICAgOiBcIiMyNTI1QzlcIixcbiAgICAgIGNvbG9yICAgICAgIDogXCIjMzMzMzMzXCIsXG4gICAgICB3ZWlnaHQgICAgICA6IDEsXG4gICAgICBvcGFjaXR5ICAgICA6IDEsXG4gICAgICBmaWxsT3BhY2l0eSA6IDAuMyxcbiAgICAgIHNpZGVzICAgICAgIDogNCxcbiAgICAgIHJvdGF0ZSAgICAgIDogNDUsXG4gICAgICB3aWR0aDogMjAsXG4gICAgICBoZWlnaHQ6IDIwXG4gICAgfSxcbiAgICB1bmFsbG9jYXRlZCA6IHtcbiAgICAgIGZpbGxDb2xvciAgIDogXCIjZmZmZmZmXCIsXG4gICAgICBjb2xvciAgICAgICA6IFwiIzMzMzMzM1wiLFxuICAgICAgd2VpZ2h0ICAgICAgOiAxLFxuICAgICAgb3BhY2l0eSAgICAgOiAxLFxuICAgICAgZmlsbE9wYWNpdHkgOiAwLjMsXG4gICAgICBzaWRlcyAgICAgICA6IDQsXG4gICAgICByb3RhdGUgICAgICA6IDQ1LFxuICAgICAgd2lkdGg6IDIwLFxuICAgICAgaGVpZ2h0OiAyMFxuICAgIH1cbiAgfSxcbiAgbm9EZW1hbmQgOiB7XG4gICAgbm9GaWxsIDogdHJ1ZSxcbiAgICAvL3NpZGVzIDogMCxcbiAgICBjb2xvciA6IFwiIzMzMzMzM1wiLFxuICAgIHN0cmlrZXRocm91Z2ggOiB0cnVlLFxuICAgIHJhZGl1cyA6IDUsXG4gICAgaGVpZ2h0IDogMTIsXG4gICAgd2lkdGggOiAxMlxuICB9XG59O1xubW9kdWxlLmV4cG9ydHMuZGVmYXVsdHMgPSBtYXJrZXJzO1xuXG5tb2R1bGUuZXhwb3J0cy5wZXJjZW50RGVtYW5kID0gZnVuY3Rpb24ob3B0aW9ucywgcGVyY2VudCwgbm9EZW1hbmQpIHtcbiAgaWYoIG5vRGVtYW5kICkge1xuICAgICAkLmV4dGVuZCh0cnVlLCBvcHRpb25zLCBtYXJrZXJzLm5vRGVtYW5kKTtcbiAgICAgcmV0dXJuO1xuICB9XG5cbiAgdmFyIG87XG5cbiAgaWYoIGdsb2JhbC5zZXR0aW5ncy5yZW5kZXJEZW1hbmQgPT0gJ2ZpbGxlZCcgKSB7XG5cbiAgICBpZiggcGVyY2VudCA8PSAwICkge1xuICAgICAgb3B0aW9ucy5maWxsQ29sb3IgPSAnIzMzMyc7XG4gICAgICBvcHRpb25zLmZpbGxPcGFjaXR5ID0gMC4zO1xuICAgIH0gZWxzZSB7XG4gICAgICBvID0gcGVyY2VudDtcbiAgICAgIGlmKCBvID4gMSApIG8gPSAxO1xuICAgICAgb3B0aW9ucy5maWxsT3BhY2l0eSA9IG87XG4gICAgICBvcHRpb25zLmZpbGxDb2xvciA9ICcjMDAwMGZmJztcbiAgICB9XG5cbiAgfSBlbHNlIHtcblxuICAgIGlmKCBwZXJjZW50ID49IDEgKSB7XG4gICAgICBvcHRpb25zLmZpbGxDb2xvciA9ICcjMzMzJztcbiAgICAgIG9wdGlvbnMuZmlsbE9wYWNpdHkgPSAwLjM7XG4gICAgfSBlbHNlIHtcbiAgICAgIG8gPSAxIC0gcGVyY2VudDtcbiAgICAgIGlmKCBvID4gMSApIG8gPSAxO1xuICAgICAgaWYoIG8gPCAwICkgbyA9IDA7XG5cbiAgICAgIG9wdGlvbnMuZmlsbE9wYWNpdHkgPSBvO1xuICAgICAgb3B0aW9ucy5maWxsQ29sb3IgPSAnI2ZmMDAwMCc7XG4gICAgfVxuXG4gIH1cbiAgLy9vcHRpb25zLmZpbGxDb2xvciA9ICcjJytnZXRDb2xvcihhbGxvY2F0aW9uIC8gZGVtYW5kKTtcbn07XG5cbm1vZHVsZS5leHBvcnRzLnBlcmNlbnREZW1hbmRIdWMgPSBmdW5jdGlvbihwZXJjZW50KSB7XG4gIGlmKCBwZXJjZW50ID09IC0xICkge1xuICAgICByZXR1cm4ge1xuICAgICAgIGZpbGxDb2xvciA6ICcjZmZmZmZmJyxcbiAgICAgICBmaWxsT3BhY2l0eSA6IDAuMixcbiAgICAgICB3ZWlnaHQgOiAxLFxuICAgICAgIGNvbG9yOiAnIzMzMzMzMydcbiAgICAgfTtcbiAgfVxuXG5cbiAgaWYoIGdsb2JhbC5zZXR0aW5ncy5yZW5kZXJEZW1hbmQgPT0gJ2ZpbGxlZCcgKSB7XG5cbiAgICBpZiggcGVyY2VudCA8PSAwICkge1xuXG4gICAgICByZXR1cm4ge1xuICAgICAgICBmaWxsQ29sb3IgOiAnIzMzMzMzMycsXG4gICAgICAgIGZpbGxPcGFjaXR5IDogMC4zLFxuICAgICAgICB3ZWlnaHQgOiAyLFxuICAgICAgICBjb2xvcjogJyMzMzMzMzMnXG4gICAgICB9O1xuXG5cbiAgICB9IGVsc2Uge1xuICAgICAgdmFyIG8gPSBwZXJjZW50O1xuICAgICAgaWYoIG8gPiAwLjggKSBvID0gMC44O1xuXG4gICAgICByZXR1cm4ge1xuICAgICAgICBmaWxsQ29sb3IgOiAnIzAwMDBmZicsXG4gICAgICAgIGZpbGxPcGFjaXR5IDogbyxcbiAgICAgICAgd2VpZ2h0IDogMixcbiAgICAgICAgY29sb3I6ICcjMzMzMzMzJ1xuICAgICAgfTtcbiAgICB9XG5cbiAgfSBlbHNlIHtcblxuICAgIGlmKCBwZXJjZW50ID49IDEgKSB7XG5cbiAgICAgIHJldHVybiB7XG4gICAgICAgIGZpbGxDb2xvciA6ICcjMzMzMzMzJyxcbiAgICAgICAgZmlsbE9wYWNpdHkgOiAwLjMsXG4gICAgICAgIHdlaWdodCA6IDIsXG4gICAgICAgIGNvbG9yOiAnIzMzMzMzMydcbiAgICAgIH07XG5cbiAgICB9IGVsc2Uge1xuICAgICAgdmFyIG8gPSAxIC0gcGVyY2VudDtcbiAgICAgIGlmKCBvID4gMC44ICkgbyA9IDAuODtcbiAgICAgIGlmKCBvIDwgMCApIG8gPSAwO1xuXG4gICAgICByZXR1cm4ge1xuICAgICAgICBmaWxsQ29sb3IgOiAnI2ZmMDAwMCcsXG4gICAgICAgIGZpbGxPcGFjaXR5IDogbyxcbiAgICAgICAgd2VpZ2h0IDogMixcbiAgICAgICAgY29sb3I6ICcjMzMzMzMzJ1xuICAgICAgfTtcblxuICAgIH1cblxuICB9XG4gIC8vb3B0aW9ucy5maWxsQ29sb3IgPSAnIycrZ2V0Q29sb3IoYWxsb2NhdGlvbiAvIGRlbWFuZCk7XG59O1xuIiwidmFyIEljb25SZW5kZXJlciA9IHJlcXVpcmUoJy4vaWNvblJlbmRlcmVyJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oY29uZmlnKSB7XG4gIHRoaXMuY29uZmlnID0gY29uZmlnO1xuICB0aGlzLmVsZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2NhbnZhcycpO1xuXG4gIHRoaXMucmVkcmF3ID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIHcgPSBjb25maWcuaGVpZ2h0IHx8IDMyO1xuICAgIHZhciBoID0gY29uZmlnLndpZHRoIHx8IDMyO1xuXG4gICAgdGhpcy5lbGUuaGVpZ2h0ID0gaDtcbiAgICB0aGlzLmVsZS53aWR0aCA9IHc7XG5cbiAgICB2YXIgY3R4ID0gdGhpcy5lbGUuZ2V0Q29udGV4dChcIjJkXCIpO1xuICAgIGN0eC5jbGVhclJlY3QoMCwgMCwgdywgaCk7XG5cbiAgICBJY29uUmVuZGVyZXIoY3R4LCBjb25maWcpO1xuICB9O1xuXG4gIHRoaXMucmVkcmF3KCk7XG59O1xuIiwidmFyIHV0aWwgPSByZXF1aXJlKCcuL3V0aWxzJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oY3R4LCBjb25maWcsIHh5UG9pbnRzKSB7XG5cbiAgdmFyIHNpZGVzID0gY29uZmlnLnNpZGVzICE9PSBudWxsID8gY29uZmlnLnNpZGVzIDogNjtcbiAgdmFyIHJvdGF0ZSA9IGNvbmZpZy5yb3RhdGUgPyBjb25maWcucm90YXRlIDogMDtcbiAgdmFyIHgsIHk7XG4gIGlmKCB4eVBvaW50cyApIHtcbiAgICB4ID0geHlQb2ludHMueDtcbiAgICB5ID0geHlQb2ludHMueTtcbiAgfSBlbHNlIHtcbiAgICB4ID0gY29uZmlnLndpZHRoIC8gMjtcbiAgICB5ID0gY29uZmlnLmhlaWdodCAvIDI7XG4gIH1cblxuICB2YXIgYSA9ICgoTWF0aC5QSSAqIDIpIC8gY29uZmlnLnNpZGVzKTtcbiAgdmFyIHIgPSByb3RhdGUgKiAoTWF0aC5QSSAvIDE4MCk7XG5cbiAgdmFyIHJhZGl1cyA9IChjb25maWcud2lkdGggLyAyKSAtIDE7XG5cbiAgdmFyIGZpbGxTdHlsZSA9IHV0aWwuaGV4VG9SZ2IoY29uZmlnLmZpbGxDb2xvcik7XG4gIGZpbGxTdHlsZS5wdXNoKGNvbmZpZy5maWxsT3BhY2l0eSk7XG4gIGN0eC5maWxsU3R5bGUgPSAncmdiYSgnK2ZpbGxTdHlsZS5qb2luKCcsJykrJyknO1xuXG4gIHZhciBjb2xvciA9IGNvbmZpZy5oaWdobGlnaHQgPyAneWVsbG93JyA6IGNvbmZpZy5jb2xvcjtcbiAgaWYoIGNvbmZpZy5ob3ZlciApIGNvbG9yID0gJ29yYW5nZSc7XG4gIGN0eC5zdHJva2VTdHlsZSA9IGNvbG9yO1xuXG4gIC8vIHRoaW5rIHlvdSBuZWVkIHRvIGFkanVzdCBieSB4LCB5XG4gIGN0eC5iZWdpblBhdGgoKTtcblxuICAvLyBkcmF3IGNpcmNsZVxuICBpZiAoIHNpZGVzIDwgMyApIHtcblxuICAgIGN0eC5hcmMoeCwgeSwgcmFkaXVzLCAwLCAyKk1hdGguUEkpO1xuXG4gIH0gZWxzZSB7XG5cbiAgICB2YXIgdHgsIHR5LCBpO1xuICAgIGZvciAoaSA9IDA7IGkgPCBjb25maWcuc2lkZXM7IGkrKykge1xuICAgICAgdHggPSB4ICsgKHJhZGl1cyAqIE1hdGguY29zKGEqaS1yKSk7XG4gICAgICB0eSA9IHkgKyAocmFkaXVzICogTWF0aC5zaW4oYSppLXIpKTtcblxuICAgICAgaWYoIGkgPT09IDAgKSBjdHgubW92ZVRvKHR4LCB0eSk7XG4gICAgICBlbHNlIGN0eC5saW5lVG8odHgsIHR5KTtcbiAgICB9XG5cbiAgICBjdHgubGluZVRvKHggKyAocmFkaXVzICogTWF0aC5jb3MoLTEgKiByKSksIHkgKyAocmFkaXVzICogTWF0aC5zaW4oLTEgKiByKSkpO1xuICAgIGN0eC5jbG9zZVBhdGgoKTtcbiAgfVxuXG4gIGlmKCAhY29uZmlnLm5vRmlsbCApIGN0eC5maWxsKCk7XG4gIGN0eC5zdHJva2UoKTtcblxuICBpZiggY29uZmlnLnN0cmlrZXRocm91Z2ggKSB7XG4gICAgY3R4LmJlZ2luUGF0aCgpO1xuICAgIGlmKCB4eVBvaW50cyApIHtcbiAgICAgIHZhciB3MiA9IGNvbmZpZy53aWR0aCAvIDIsIGgyID0gY29uZmlnLmhlaWdodCAvIDI7XG4gICAgICBjdHgubW92ZVRvKHgtdzIsIHktaDIpO1xuICAgICAgY3R4LmxpbmVUbyh4K3cyIC0gMSwgeStoMiAtIDEpO1xuICAgIH0gZWxzZSB7XG4gICAgICBjdHgubW92ZVRvKDEsIDEpO1xuICAgICAgY3R4LmxpbmVUbyhjb25maWcud2lkdGggLSAxLCBjb25maWcuaGVpZ2h0IC0gMSk7XG4gICAgfVxuXG4gICAgY3R4LnN0cm9rZSgpO1xuICAgIGN0eC5jbG9zZVBhdGgoKTtcbiAgfVxufTtcbiIsInZhciBkYXRhID0ge1xuICBzZWxlY3RlZCA6IG51bGwsXG4gIGhvdmVyZWQgOiBudWxsXG59O1xudmFyIGxheWVyO1xuXG5tb2R1bGUuZXhwb3J0cy5pbml0ID0gZnVuY3Rpb24obCkge1xuICBsYXllciA9IGw7XG59O1xuXG5tb2R1bGUuZXhwb3J0cy5ob3ZlciA9IGZ1bmN0aW9uKG1hcmtlcnMpIHtcbiAgdXBkYXRlKCdob3ZlcmVkJywgJ2hvdmVyJywgbWFya2Vycyk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cy5ub2hvdmVyID0gZnVuY3Rpb24obWFya2Vycykge1xuICBpZiggIWRhdGEuaG92ZXJlZCApIHJldHVybjtcblxuICBmb3IoIHZhciBpID0gMDsgaSA8IG1hcmtlcnMubGVuZ3RoOyBpKysgKSB7XG4gICAgdmFyIGluZGV4ID0gZGF0YS5ob3ZlcmVkLmluZGV4T2YobWFya2Vyc1tpXSk7XG4gICAgaWYoIGluZGV4ID4gLTEgKSBkYXRhLmhvdmVyZWRbaW5kZXhdLnByb3BlcnRpZXMuX3JlbmRlci5ob3ZlciA9IGZhbHNlO1xuICB9XG5cbiAgbGF5ZXIucmVuZGVyKCk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cy5zZWxlY3QgPSBmdW5jdGlvbihtYXJrZXJzKSB7XG4gIHVwZGF0ZSgnc2VsZWN0ZWQnLCAnaGlnaGxpZ2h0JywgbWFya2Vycyk7XG59O1xuXG5mdW5jdGlvbiB1cGRhdGUoYXJyYXksIHByb3BlcnR5LCBtYXJrZXJzKSB7XG4gIGlmKCBkYXRhW2FycmF5XSAhPT0gbnVsbCApIHtcbiAgICBkYXRhW2FycmF5XS5mb3JFYWNoKGZ1bmN0aW9uKG1hcmtlcil7XG4gICAgICBtYXJrZXIucHJvcGVydGllcy5fcmVuZGVyW3Byb3BlcnR5XSA9IGZhbHNlO1xuICAgIH0pO1xuICB9XG5cbiAgaWYoIG1hcmtlcnMgKSB7XG4gICAgZGF0YVthcnJheV0gPSBtYXJrZXJzO1xuICAgIG1hcmtlcnMuZm9yRWFjaChmdW5jdGlvbihtYXJrZXIpe1xuICAgICAgbWFya2VyLnByb3BlcnRpZXMuX3JlbmRlcltwcm9wZXJ0eV0gPSB0cnVlO1xuICAgIH0pO1xuICB9XG5cbiAgaWYoIGxheWVyICkge1xuICAgIGxheWVyLnJlbmRlcigpO1xuICB9XG59XG4iLCJtb2R1bGUuZXhwb3J0cy5oZXhUb1JnYiA9IGZ1bmN0aW9uKGhleCkge1xuICAgIHZhciByZXN1bHQgPSAvXiM/KFthLWZcXGRdezJ9KShbYS1mXFxkXXsyfSkoW2EtZlxcZF17Mn0pJC9pLmV4ZWMoaGV4KTtcbiAgICByZXR1cm4gcmVzdWx0ID8gW1xuICAgICAgICBwYXJzZUludChyZXN1bHRbMV0sIDE2KSxcbiAgICAgICAgcGFyc2VJbnQocmVzdWx0WzJdLCAxNiksXG4gICAgICAgIHBhcnNlSW50KHJlc3VsdFszXSwgMTYpXG4gICAgXSA6IFswLDAsMF07XG59O1xuXG5tb2R1bGUuZXhwb3J0cy5nZXRDb2xvciA9IGZ1bmN0aW9uKG51bSkge1xuICBpZiggbnVtID4gMSApIG51bSA9IDE7XG4gIGlmKCBudW0gPCAwICkgbnVtID0gMDtcblxuICB2YXIgc3ByZWFkID0gTWF0aC5mbG9vcig1MTAqbnVtKSAtIDI1NTtcblxuICBpZiggc3ByZWFkIDwgMCApIHJldHVybiBcImZmMDBcIit0b0hleCgyNTUrc3ByZWFkKTtcbiAgZWxzZSBpZiggc3ByZWFkID4gMCApIHJldHVybiB0b0hleCgyNTUtc3ByZWFkKStcIjAwZmZcIjtcbiAgZWxzZSByZXR1cm4gXCJmZmZmMDBcIjtcbn07XG5cbm1vZHVsZS5leHBvcnRzLnRvSGV4ID0gZnVuY3Rpb24obnVtKSB7XG4gIG51bSA9IG51bS50b1N0cmluZygxNik7XG4gIGlmKCBudW0ubGVuZ3RoID09IDEgKSBudW0gPSBcIjBcIitudW07XG4gIHJldHVybiBudW07XG59O1xuIiwiLyoqXG4gIEEgRmVhdHVyZSBzaG91bGQgaGF2ZSB0aGUgZm9sbG93aW5nOlxuXG4gIGZlYXR1cmUgPSB7XG4gICAgdmlzaWJsZSA6IEJvb2xlYW4sXG4gICAgc2l6ZSA6IE51bWJlciwgLy8gcG9pbnRzIG9ubHksIHVzZWQgZm9yIG1vdXNlIGludGVyYWN0aW9uc1xuICAgIGdlb2pzb24gOiB7fVxuICAgIHJlbmRlciA6IGZ1bmN0aW9uKGNvbnRleHQsIGNvb3JkaW5hdGVzSW5YWSwgbWFwKSB7fSAvLyBjYWxsZWQgaW4gZmVhdHVyZSBzY29wZVxuICB9XG5cbiAgZ2VvWFkgYW5kIGxlYWZsZXQgd2lsbCBiZSBhc3NpZ25lZFxuKiovXG5cbkwuQ2FudmFzR2VvanNvbkxheWVyID0gTC5DbGFzcy5leHRlbmQoe1xuICAvLyBzaG93IGxheWVyIHRpbWluZ1xuICBkZWJ1ZyA6IGZhbHNlLFxuXG4gIC8vIGluY2x1ZGUgZXZlbnRzXG4gIGluY2x1ZGVzOiBbTC5NaXhpbi5FdmVudHNdLFxuXG4gIC8vIGxpc3Qgb2YgZ2VvanNvbiBmZWF0dXJlcyB0byBkcmF3XG4gIC8vICAgLSB0aGVzZSB3aWxsIGRyYXcgaW4gb3JkZXJcbiAgZmVhdHVyZXMgOiBbXSxcblxuICAvLyBsaXN0IG9mIGN1cnJlbnQgZmVhdHVyZXMgdW5kZXIgdGhlIG1vdXNlXG4gIGludGVyc2VjdExpc3QgOiBbXSxcblxuICAvLyB1c2VkIHRvIGNhbGN1bGF0ZSBwaXhlbHMgbW92ZWQgZnJvbSBjZW50ZXJcbiAgbGFzdENlbnRlckxMIDogbnVsbCxcblxuICAvLyBnZW9tZXRyeSBoZWxwZXJzXG4gIHV0aWxzIDogcmVxdWlyZSgnLi91dGlscycpLFxuXG4gIC8vIGluaXRpYWxpemUgbGF5ZXJcbiAgaW5pdGlhbGl6ZTogZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAvLyBzZXQgb3B0aW9uc1xuICAgIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuICAgIEwuVXRpbC5zZXRPcHRpb25zKHRoaXMsIG9wdGlvbnMpO1xuXG4gICAgLy8gbW92ZSBtb3VzZSBldmVudCBoYW5kbGVycyB0byBsYXllciBzY29wZVxuICAgIHZhciBtb3VzZUV2ZW50cyA9IFsnb25Nb3VzZU92ZXInLCAnb25Nb3VzZU1vdmUnLCAnb25Nb3VzZU91dCcsICdvbkNsaWNrJ107XG4gICAgbW91c2VFdmVudHMuZm9yRWFjaChmdW5jdGlvbihlKXtcbiAgICAgIGlmKCAhdGhpcy5vcHRpb25zW2VdICkgcmV0dXJuO1xuICAgICAgdGhpc1tlXSA9IHRoaXMub3B0aW9uc1tlXTtcbiAgICAgIGRlbGV0ZSB0aGlzLm9wdGlvbnNbZV07XG4gICAgfS5iaW5kKHRoaXMpKTtcblxuICAgIC8vIHNldCBjYW52YXMgYW5kIGNhbnZhcyBjb250ZXh0IHNob3J0Y3V0c1xuICAgIHRoaXMuX2NhbnZhcyA9IHRoaXMuX2NyZWF0ZUNhbnZhcygpO1xuICAgIHRoaXMuX2N0eCA9IHRoaXMuX2NhbnZhcy5nZXRDb250ZXh0KCcyZCcpO1xuICB9LFxuXG4gIF9jcmVhdGVDYW52YXM6IGZ1bmN0aW9uKCkge1xuICAgIHZhciBjYW52YXMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdjYW52YXMnKTtcbiAgICBjYW52YXMuc3R5bGUucG9zaXRpb24gPSAnYWJzb2x1dGUnO1xuICAgIGNhbnZhcy5zdHlsZS50b3AgPSAwO1xuICAgIGNhbnZhcy5zdHlsZS5sZWZ0ID0gMDtcbiAgICBjYW52YXMuc3R5bGUucG9pbnRlckV2ZW50cyA9IFwibm9uZVwiO1xuICAgIGNhbnZhcy5zdHlsZS56SW5kZXggPSB0aGlzLm9wdGlvbnMuekluZGV4IHx8IDA7XG4gICAgdmFyIGNsYXNzTmFtZSA9ICdsZWFmbGV0LXRpbGUtY29udGFpbmVyIGxlYWZsZXQtem9vbS1hbmltYXRlZCc7XG4gICAgY2FudmFzLnNldEF0dHJpYnV0ZSgnY2xhc3MnLCBjbGFzc05hbWUpO1xuICAgIHJldHVybiBjYW52YXM7XG4gIH0sXG5cbiAgb25BZGQ6IGZ1bmN0aW9uIChtYXApIHtcbiAgICB0aGlzLl9tYXAgPSBtYXA7XG5cbiAgICAvLyBhZGQgY29udGFpbmVyIHdpdGggdGhlIGNhbnZhcyB0byB0aGUgdGlsZSBwYW5lXG4gICAgLy8gdGhlIGNvbnRhaW5lciBpcyBtb3ZlZCBpbiB0aGUgb3Bvc2l0ZSBkaXJlY3Rpb24gb2YgdGhlXG4gICAgLy8gbWFwIHBhbmUgdG8ga2VlcCB0aGUgY2FudmFzIGFsd2F5cyBpbiAoMCwgMClcbiAgICAvL3ZhciB0aWxlUGFuZSA9IHRoaXMuX21hcC5fcGFuZXMudGlsZVBhbmU7XG4gICAgdmFyIHRpbGVQYW5lID0gdGhpcy5fbWFwLl9wYW5lcy5tYXJrZXJQYW5lO1xuICAgIHZhciBfY29udGFpbmVyID0gTC5Eb21VdGlsLmNyZWF0ZSgnZGl2JywgJ2xlYWZsZXQtbGF5ZXInKTtcblxuICAgIF9jb250YWluZXIuYXBwZW5kQ2hpbGQodGhpcy5fY2FudmFzKTtcbiAgICB0aWxlUGFuZS5hcHBlbmRDaGlsZChfY29udGFpbmVyKTtcblxuICAgIHRoaXMuX2NvbnRhaW5lciA9IF9jb250YWluZXI7XG5cbiAgICAvLyBoYWNrOiBsaXN0ZW4gdG8gcHJlZHJhZyBldmVudCBsYXVuY2hlZCBieSBkcmFnZ2luZyB0b1xuICAgIC8vIHNldCBjb250YWluZXIgaW4gcG9zaXRpb24gKDAsIDApIGluIHNjcmVlbiBjb29yZGluYXRlc1xuICAgIGlmIChtYXAuZHJhZ2dpbmcuZW5hYmxlZCgpKSB7XG4gICAgICBtYXAuZHJhZ2dpbmcuX2RyYWdnYWJsZS5vbigncHJlZHJhZycsIGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgZCA9IG1hcC5kcmFnZ2luZy5fZHJhZ2dhYmxlO1xuICAgICAgICBMLkRvbVV0aWwuc2V0UG9zaXRpb24odGhpcy5fY2FudmFzLCB7IHg6IC1kLl9uZXdQb3MueCwgeTogLWQuX25ld1Bvcy55IH0pO1xuICAgICAgfSwgdGhpcyk7XG4gICAgfVxuXG4gICAgbWFwLm9uKHtcbiAgICAgICd2aWV3cmVzZXQnIDogdGhpcy5fcmVzZXQsXG4gICAgICAncmVzaXplJyAgICA6IHRoaXMuX3Jlc2V0LFxuICAgICAgJ21vdmUnICAgICAgOiB0aGlzLnJlbmRlcixcbiAgICAgICd6b29tc3RhcnQnIDogdGhpcy5fc3RhcnRab29tLFxuICAgICAgJ3pvb21lbmQnICAgOiB0aGlzLl9lbmRab29tLFxuICAgICAgJ21vdXNlbW92ZScgOiB0aGlzLl9pbnRlcnNlY3RzLFxuICAgICAgJ2NsaWNrJyAgICAgOiB0aGlzLl9pbnRlcnNlY3RzXG4gICAgfSwgdGhpcyk7XG5cbiAgICB0aGlzLl9yZXNldCgpO1xuXG4gICAgaWYoIHRoaXMuekluZGV4ICE9PSB1bmRlZmluZWQgKSB7XG4gICAgICB0aGlzLnNldFpJbmRleCh0aGlzLnpJbmRleCk7XG4gICAgfVxuICB9LFxuXG4gIHNldFpJbmRleCA6IGZ1bmN0aW9uKGluZGV4KSB7XG4gICAgdGhpcy56SW5kZXggPSBpbmRleDtcbiAgICBpZiggdGhpcy5fY29udGFpbmVyICkge1xuICAgICAgdGhpcy5fY29udGFpbmVyLnN0eWxlLnpJbmRleCA9IGluZGV4O1xuICAgIH1cbiAgfSxcblxuICBfc3RhcnRab29tOiBmdW5jdGlvbigpIHtcbiAgICB0aGlzLl9jYW52YXMuc3R5bGUudmlzaWJpbGl0eSA9ICdoaWRkZW4nO1xuICAgIHRoaXMuem9vbWluZyA9IHRydWU7XG4gIH0sXG5cbiAgX2VuZFpvb206IGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLl9jYW52YXMuc3R5bGUudmlzaWJpbGl0eSA9ICd2aXNpYmxlJztcbiAgICB0aGlzLnpvb21pbmcgPSBmYWxzZTtcbiAgICBzZXRUaW1lb3V0KHRoaXMucmVuZGVyLmJpbmQodGhpcyksIDUwKTtcbiAgfSxcblxuICBnZXRDYW52YXM6IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLl9jYW52YXM7XG4gIH0sXG5cbiAgZHJhdzogZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5fcmVzZXQoKTtcbiAgfSxcblxuICBvblJlbW92ZTogZnVuY3Rpb24gKG1hcCkge1xuICAgIHRoaXMuX2NvbnRhaW5lci5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKHRoaXMuX2NvbnRhaW5lcik7XG4gICAgbWFwLm9mZih7XG4gICAgICAndmlld3Jlc2V0JyA6IHRoaXMuX3Jlc2V0LFxuICAgICAgJ3Jlc2l6ZScgICAgOiB0aGlzLl9yZXNldCxcbiAgICAgICdtb3ZlJyAgICAgIDogdGhpcy5yZW5kZXIsXG4gICAgICAnem9vbXN0YXJ0JyA6IHRoaXMuX3N0YXJ0Wm9vbSxcbiAgICAgICd6b29tZW5kJyAgIDogdGhpcy5fZW5kWm9vbSxcbiAgICAgICdtb3VzZW1vdmUnIDogdGhpcy5faW50ZXJzZWN0cyxcbiAgICAgICdjbGljaycgICAgIDogdGhpcy5faW50ZXJzZWN0c1xuICAgIH0sIHRoaXMpO1xuICB9LFxuXG4gIGFkZFRvOiBmdW5jdGlvbiAobWFwKSB7XG4gICAgbWFwLmFkZExheWVyKHRoaXMpO1xuICAgIHJldHVybiB0aGlzO1xuICB9LFxuXG4gIF9yZXNldDogZnVuY3Rpb24gKCkge1xuICAgIC8vIHJlc2V0IGFjdHVhbCBjYW52YXMgc2l6ZVxuICAgIHZhciBzaXplID0gdGhpcy5fbWFwLmdldFNpemUoKTtcbiAgICB0aGlzLl9jYW52YXMud2lkdGggPSBzaXplLng7XG4gICAgdGhpcy5fY2FudmFzLmhlaWdodCA9IHNpemUueTtcblxuICAgIHRoaXMuY2xlYXJDYWNoZSgpO1xuXG4gICAgdGhpcy5yZW5kZXIoKTtcbiAgfSxcblxuICAvLyBjbGVhciBlYWNoIGZlYXR1cmVzIGNhY2hlXG4gIGNsZWFyQ2FjaGUgOiBmdW5jdGlvbigpIHtcbiAgICAvLyBraWxsIHRoZSBmZWF0dXJlIHBvaW50IGNhY2hlXG4gICAgZm9yKCB2YXIgaSA9IDA7IGkgPCB0aGlzLmZlYXR1cmVzLmxlbmd0aDsgaSsrICkge1xuICAgICAgdGhpcy5jbGVhckZlYXR1cmVDYWNoZSggdGhpcy5mZWF0dXJlc1tpXSApO1xuICAgIH1cbiAgfSxcblxuICBjbGVhckZlYXR1cmVDYWNoZSA6IGZ1bmN0aW9uKGZlYXR1cmUpIHtcbiAgICBpZiggIWZlYXR1cmUuY2FjaGUgKSByZXR1cm47XG4gICAgZmVhdHVyZS5jYWNoZS5nZW9YWSA9IG51bGw7XG4gIH0sXG5cbiAgLy8gcmVkcmF3IGFsbCBmZWF0dXJlcy4gIFRoaXMgZG9lcyBub3QgaGFuZGxlIGNsZWFyaW5nIHRoZSBjYW52YXMgb3Igc2V0dGluZ1xuICAvLyB0aGUgY2FudmFzIGNvcnJlY3QgcG9zaXRpb24uICBUaGF0IGlzIGhhbmRsZWQgYnkgcmVuZGVyXG4gIHJlZHJhdzogZnVuY3Rpb24oZGlmZikge1xuICAgIC8vIG9iamVjdHMgc2hvdWxkIGtlZXAgdHJhY2sgb2YgbGFzdCBiYm94IGFuZCB6b29tIG9mIG1hcFxuICAgIC8vIGlmIHRoaXMgaGFzbid0IGNoYW5nZWQgdGhlIGxsIC0+IGNvbnRhaW5lciBwdCBpcyBub3QgbmVlZGVkXG4gICAgdmFyIGJvdW5kcyA9IHRoaXMuX21hcC5nZXRCb3VuZHMoKTtcbiAgICB2YXIgem9vbSA9IHRoaXMuX21hcC5nZXRab29tKCk7XG5cbiAgICBpZiggdGhpcy5kZWJ1ZyApIHQgPSBuZXcgRGF0ZSgpLmdldFRpbWUoKTtcblxuICAgIGZvciggdmFyIGkgPSAwOyBpIDwgdGhpcy5mZWF0dXJlcy5sZW5ndGg7IGkrKyApIHtcbiAgICAgIHRoaXMucmVkcmF3RmVhdHVyZSh0aGlzLmZlYXR1cmVzW2ldLCBib3VuZHMsIHpvb20sIGRpZmYpO1xuICAgIH1cblxuICAgIGlmKCB0aGlzLmRlYnVnICkgY29uc29sZS5sb2coJ1JlbmRlciB0aW1lOiAnKyhuZXcgRGF0ZSgpLmdldFRpbWUoKSAtIHQpKydtczsgYXZnOiAnK1xuICAgICAgKChuZXcgRGF0ZSgpLmdldFRpbWUoKSAtIHQpIC8gdGhpcy5mZWF0dXJlcy5sZW5ndGgpKydtcycpO1xuICB9LFxuXG4gIC8vIHJlZHJhdyBhbiBpbmRpdmlkdWFsIGZlYXR1cmVcbiAgcmVkcmF3RmVhdHVyZSA6IGZ1bmN0aW9uKGZlYXR1cmUsIGJvdW5kcywgem9vbSwgZGlmZikge1xuICAgIC8vaWYoIGZlYXR1cmUuZ2VvanNvbi5wcm9wZXJ0aWVzLmRlYnVnICkgZGVidWdnZXI7XG5cbiAgICAvLyBpZ25vcmUgYW55dGhpbmcgZmxhZ2dlZCBhcyBoaWRkZW5cbiAgICAvLyB3ZSBkbyBuZWVkIHRvIGNsZWFyIHRoZSBjYWNoZSBpbiB0aGlzIGNhc2VcbiAgICBpZiggIWZlYXR1cmUudmlzaWJsZSApIHtcbiAgICAgIHRoaXMuY2xlYXJGZWF0dXJlQ2FjaGUoZmVhdHVyZSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gbm93IGxldHMgY2hlY2sgY2FjaGUgdG8gc2VlIGlmIHdlIG5lZWQgdG8gcmVwcm9qZWN0IHRoZVxuICAgIC8vIHh5IGNvb3JkaW5hdGVzXG4gICAgdmFyIHJlcHJvamVjdCA9IHRydWU7XG4gICAgaWYoIGZlYXR1cmUuY2FjaGUgKSB7XG4gICAgICBpZiggZmVhdHVyZS5jYWNoZS56b29tID09IHpvb20gJiYgZmVhdHVyZS5jYWNoZS5nZW9YWSApIHtcbiAgICAgICAgcmVwcm9qZWN0ID0gZmFsc2U7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gYWN0dWFsbHkgcHJvamVjdCB0byB4eSBpZiBuZWVkZWRcbiAgICBpZiggcmVwcm9qZWN0ICkge1xuICAgICAgdGhpcy5fY2FsY0dlb1hZKGZlYXR1cmUsIHpvb20pO1xuICAgIH0gIC8vIGVuZCByZXByb2plY3RcblxuICAgIC8vIGlmIHRoaXMgd2FzIGEgc2ltcGxlIHBhbiBldmVudCAoYSBkaWZmIHdhcyBwcm92aWRlZCkgYW5kIHdlIGRpZCBub3QgcmVwcm9qZWN0XG4gICAgLy8gbW92ZSB0aGUgZmVhdHVyZSBieSBkaWZmIHgveVxuICAgIGlmKCBkaWZmICYmICFyZXByb2plY3QgKSB7XG4gICAgICBpZiggZmVhdHVyZS5nZW9qc29uLmdlb21ldHJ5LnR5cGUgPT0gJ1BvaW50JyApIHtcblxuICAgICAgICBmZWF0dXJlLmNhY2hlLmdlb1hZLnggKz0gZGlmZi54O1xuICAgICAgICBmZWF0dXJlLmNhY2hlLmdlb1hZLnkgKz0gZGlmZi55O1xuXG4gICAgICB9IGVsc2UgaWYoIGZlYXR1cmUuZ2VvanNvbi5nZW9tZXRyeS50eXBlID09ICdMaW5lU3RyaW5nJyApIHtcblxuICAgICAgICB0aGlzLnV0aWxzLm1vdmVMaW5lKGZlYXR1cmUuY2FjaGUuZ2VvWFksIGRpZmYpO1xuXG4gICAgICB9IGVsc2UgaWYgKCBmZWF0dXJlLmdlb2pzb24uZ2VvbWV0cnkudHlwZSA9PSAnUG9seWdvbicgKSB7XG4gICAgICAgIHRoaXMudXRpbHMubW92ZUxpbmUoZmVhdHVyZS5jYWNoZS5nZW9YWSwgZGlmZik7XG4gICAgICB9IGVsc2UgaWYgKCBmZWF0dXJlLmdlb2pzb24uZ2VvbWV0cnkudHlwZSA9PSAnTXVsdGlQb2x5Z29uJyApIHtcbiAgICAgICAgZm9yKCB2YXIgaSA9IDA7IGkgPCBmZWF0dXJlLmNhY2hlLmdlb1hZLmxlbmd0aDsgaSsrICkge1xuICAgICAgICAgIHRoaXMudXRpbHMubW92ZUxpbmUoZmVhdHVyZS5jYWNoZS5nZW9YWVtpXSwgZGlmZik7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBpZ25vcmUgYW55dGhpbmcgbm90IGluIGJvdW5kc1xuICAgIGlmKCBmZWF0dXJlLmdlb2pzb24uZ2VvbWV0cnkudHlwZSA9PSAnUG9pbnQnICkge1xuICAgICAgaWYoICFib3VuZHMuY29udGFpbnMoZmVhdHVyZS5sYXRsbmcpICkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgfSBlbHNlIGlmKCBmZWF0dXJlLmdlb2pzb24uZ2VvbWV0cnkudHlwZSA9PSAnTXVsdGlQb2x5Z29uJyApIHtcblxuICAgICAgLy8ganVzdCBtYWtlIHN1cmUgYXQgbGVhc3Qgb25lIHBvbHlnb24gaXMgd2l0aGluIHJhbmdlXG4gICAgICB2YXIgZm91bmQgPSBmYWxzZTtcbiAgICAgIGZvciggdmFyIGkgPSAwOyBpIDwgZmVhdHVyZS5ib3VuZHMubGVuZ3RoOyBpKysgKSB7XG4gICAgICAgIGlmKCBib3VuZHMuY29udGFpbnMoZmVhdHVyZS5ib3VuZHNbaV0pIHx8IGJvdW5kcy5pbnRlcnNlY3RzKGZlYXR1cmUuYm91bmRzW2ldKSApIHtcbiAgICAgICAgICBmb3VuZCA9IHRydWU7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmKCAhZm91bmQgKSByZXR1cm47XG5cbiAgICB9IGVsc2Uge1xuICAgICAgaWYoICFib3VuZHMuY29udGFpbnMoZmVhdHVyZS5ib3VuZHMpICYmICFib3VuZHMuaW50ZXJzZWN0cyhmZWF0dXJlLmJvdW5kcykgKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBjYWxsIGZlYXR1cmUgcmVuZGVyIGZ1bmN0aW9uIGluIGZlYXR1cmUgc2NvcGU7IGZlYXR1cmUgaXMgcGFzc2VkIGFzIHdlbGxcbiAgICBmZWF0dXJlLnJlbmRlci5jYWxsKGZlYXR1cmUsIHRoaXMuX2N0eCwgZmVhdHVyZS5jYWNoZS5nZW9YWSwgdGhpcy5fbWFwLCBmZWF0dXJlKTtcbiAgfSxcblxuICBfY2FsY0dlb1hZIDogZnVuY3Rpb24oZmVhdHVyZSwgem9vbSkge1xuICAgIC8vIG1ha2Ugc3VyZSB3ZSBoYXZlIGEgY2FjaGUgbmFtZXNwYWNlIGFuZCBzZXQgdGhlIHpvb20gbGV2ZWxcbiAgICBpZiggIWZlYXR1cmUuY2FjaGUgKSBmZWF0dXJlLmNhY2hlID0ge307XG4gICAgZmVhdHVyZS5jYWNoZS56b29tID0gem9vbTtcblxuICAgIGlmKCBmZWF0dXJlLmdlb2pzb24uZ2VvbWV0cnkudHlwZSA9PSAnUG9pbnQnICkge1xuXG4gICAgICBmZWF0dXJlLmNhY2hlLmdlb1hZID0gdGhpcy5fbWFwLmxhdExuZ1RvQ29udGFpbmVyUG9pbnQoW1xuICAgICAgICAgIGZlYXR1cmUuZ2VvanNvbi5nZW9tZXRyeS5jb29yZGluYXRlc1sxXSxcbiAgICAgICAgICBmZWF0dXJlLmdlb2pzb24uZ2VvbWV0cnkuY29vcmRpbmF0ZXNbMF1cbiAgICAgIF0pO1xuXG4gICAgICBpZiggZmVhdHVyZS5zaXplICkge1xuICAgICAgICBmZWF0dXJlLmNhY2hlLmdlb1hZWzBdID0gZmVhdHVyZS5jYWNoZS5nZW9YWVswXSAtIGZlYXR1cmUuc2l6ZSAvIDI7XG4gICAgICAgIGZlYXR1cmUuY2FjaGUuZ2VvWFlbMV0gPSBmZWF0dXJlLmNhY2hlLmdlb1hZWzFdIC0gZmVhdHVyZS5zaXplIC8gMjtcbiAgICAgIH1cblxuICAgIH0gZWxzZSBpZiggZmVhdHVyZS5nZW9qc29uLmdlb21ldHJ5LnR5cGUgPT0gJ0xpbmVTdHJpbmcnICkge1xuICAgICAgZmVhdHVyZS5jYWNoZS5nZW9YWSA9IHRoaXMudXRpbHMucHJvamVjdExpbmUoZmVhdHVyZS5nZW9qc29uLmdlb21ldHJ5LmNvb3JkaW5hdGVzLCB0aGlzLl9tYXApO1xuXG4gICAgfSBlbHNlIGlmICggZmVhdHVyZS5nZW9qc29uLmdlb21ldHJ5LnR5cGUgPT0gJ1BvbHlnb24nICkge1xuICAgICAgZmVhdHVyZS5jYWNoZS5nZW9YWSA9IHRoaXMudXRpbHMucHJvamVjdExpbmUoZmVhdHVyZS5nZW9qc29uLmdlb21ldHJ5LmNvb3JkaW5hdGVzWzBdLCB0aGlzLl9tYXApO1xuICAgIH0gZWxzZSBpZiAoIGZlYXR1cmUuZ2VvanNvbi5nZW9tZXRyeS50eXBlID09ICdNdWx0aVBvbHlnb24nICkge1xuICAgICAgZmVhdHVyZS5jYWNoZS5nZW9YWSA9IFtdO1xuICAgICAgZm9yKCB2YXIgaSA9IDA7IGkgPCBmZWF0dXJlLmdlb2pzb24uZ2VvbWV0cnkuY29vcmRpbmF0ZXMubGVuZ3RoOyBpKysgKSB7XG4gICAgICAgIGZlYXR1cmUuY2FjaGUuZ2VvWFkucHVzaCh0aGlzLnV0aWxzLnByb2plY3RMaW5lKGZlYXR1cmUuZ2VvanNvbi5nZW9tZXRyeS5jb29yZGluYXRlc1tpXVswXSwgdGhpcy5fbWFwKSk7XG4gICAgICB9XG4gICAgfVxuXG4gIH0sXG5cbiAgYWRkRmVhdHVyZXMgOiBmdW5jdGlvbihmZWF0dXJlcykge1xuICAgIGZvciggdmFyIGkgPSAwOyBpIDwgdGhpcy5mZWF0dXJlcy5sZW5ndGg7IGkrKyApIHtcbiAgICAgIHRoaXMuYWRkRmVhdHVyZSh0aGlzLmZlYXR1cmVzW2ldKTtcbiAgICB9XG4gIH0sXG5cbiAgYWRkRmVhdHVyZSA6IGZ1bmN0aW9uKGZlYXR1cmUsIGJvdHRvbSkge1xuICAgIGlmKCAhZmVhdHVyZS5nZW9qc29uICkgcmV0dXJuO1xuICAgIGlmKCAhZmVhdHVyZS5nZW9qc29uLmdlb21ldHJ5ICkgcmV0dXJuO1xuXG4gICAgaWYoIHR5cGVvZiBmZWF0dXJlLnZpc2libGUgPT09ICd1bmRlZmluZWQnICkgZmVhdHVyZS52aXNpYmxlID0gdHJ1ZTtcbiAgICBmZWF0dXJlLmNhY2hlID0gbnVsbDtcblxuICAgIGlmKCBmZWF0dXJlLmdlb2pzb24uZ2VvbWV0cnkudHlwZSA9PSAnTGluZVN0cmluZycgKSB7XG4gICAgICBmZWF0dXJlLmJvdW5kcyA9IHRoaXMudXRpbHMuY2FsY0JvdW5kcyhmZWF0dXJlLmdlb2pzb24uZ2VvbWV0cnkuY29vcmRpbmF0ZXMpO1xuXG4gICAgfSBlbHNlIGlmICggZmVhdHVyZS5nZW9qc29uLmdlb21ldHJ5LnR5cGUgPT0gJ1BvbHlnb24nICkge1xuICAgICAgLy8gVE9ETzogd2Ugb25seSBzdXBwb3J0IG91dGVyIHJpbmdzIG91dCB0aGUgbW9tZW50LCBubyBpbm5lciByaW5ncy4gIFRodXMgY29vcmRpbmF0ZXNbMF1cbiAgICAgIGZlYXR1cmUuYm91bmRzID0gdGhpcy51dGlscy5jYWxjQm91bmRzKGZlYXR1cmUuZ2VvanNvbi5nZW9tZXRyeS5jb29yZGluYXRlc1swXSk7XG5cbiAgICB9IGVsc2UgaWYgKCBmZWF0dXJlLmdlb2pzb24uZ2VvbWV0cnkudHlwZSA9PSAnUG9pbnQnICkge1xuICAgICAgZmVhdHVyZS5sYXRsbmcgPSBMLmxhdExuZyhmZWF0dXJlLmdlb2pzb24uZ2VvbWV0cnkuY29vcmRpbmF0ZXNbMV0sIGZlYXR1cmUuZ2VvanNvbi5nZW9tZXRyeS5jb29yZGluYXRlc1swXSk7XG4gICAgfSBlbHNlIGlmICggZmVhdHVyZS5nZW9qc29uLmdlb21ldHJ5LnR5cGUgPT0gJ011bHRpUG9seWdvbicgKSB7XG4gICAgICBmZWF0dXJlLmJvdW5kcyA9IFtdO1xuICAgICAgZm9yKCB2YXIgaSA9IDA7IGkgPCBmZWF0dXJlLmdlb2pzb24uZ2VvbWV0cnkuY29vcmRpbmF0ZXMubGVuZ3RoOyBpKysgICkge1xuICAgICAgICBmZWF0dXJlLmJvdW5kcy5wdXNoKHRoaXMudXRpbHMuY2FsY0JvdW5kcyhmZWF0dXJlLmdlb2pzb24uZ2VvbWV0cnkuY29vcmRpbmF0ZXNbaV1bMF0pKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgY29uc29sZS5sb2coJ0dlb0pTT04gZmVhdHVyZSB0eXBlIFwiJytmZWF0dXJlLmdlb2pzb24uZ2VvbWV0cnkudHlwZSsnXCIgbm90IHN1cHBvcnRlZC4nKTtcbiAgICAgIGNvbnNvbGUubG9nKGZlYXR1cmUuZ2VvanNvbik7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYoIGJvdHRvbSApIHsgLy8gYm90dG9tIG9yIGluZGV4XG4gICAgICBpZiggdHlwZW9mIGJvdHRvbSA9PT0gJ251bWJlcicpIHRoaXMuZmVhdHVyZXMuc3BsaWNlKGJvdHRvbSwgMCwgZmVhdHVyZSk7XG4gICAgICBlbHNlIHRoaXMuZmVhdHVyZXMudW5zaGlmdChmZWF0dXJlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5mZWF0dXJlcy5wdXNoKGZlYXR1cmUpO1xuICAgIH1cbiAgfSxcblxuICBhZGRGZWF0dXJlQm90dG9tIDogZnVuY3Rpb24oZmVhdHVyZSkge1xuICAgIHRoaXMuYWRkRmVhdHVyZShmZWF0dXJlLCB0cnVlKTtcbiAgfSxcblxuICAvLyByZXR1cm5zIHRydWUgaWYgcmUtcmVuZGVyIHJlcXVpcmVkLiAgaWUgdGhlIGZlYXR1cmUgd2FzIHZpc2libGU7XG4gIHJlbW92ZUZlYXR1cmUgOiBmdW5jdGlvbihmZWF0dXJlKSB7XG4gICAgdmFyIGluZGV4ID0gdGhpcy5mZWF0dXJlcy5pbmRleE9mKGZlYXR1cmUpO1xuICAgIGlmKCBpbmRleCA9PSAtMSApIHJldHVybjtcblxuICAgIHRoaXMuc3BsaWNlKGluZGV4LCAxKTtcblxuICAgIGlmKCB0aGlzLmZlYXR1cmUudmlzaWJsZSApIHJldHVybiB0cnVlO1xuICAgIHJldHVybiBmYWxzZTtcbiAgfSxcblxuICAvLyBnZXQgbGF5ZXIgZmVhdHVyZSB2aWEgZ2VvanNvbiBvYmplY3RcbiAgZ2V0RmVhdHVyZUZvckdlb2pzb24gOiBmdW5jdGlvbihnZW9qc29uKSB7XG4gICAgZm9yKCB2YXIgaSA9IDA7IGkgPCB0aGlzLmZlYXR1cmVzLmxlbmd0aDsgaSsrICkge1xuICAgICAgaWYoIHRoaXMuZmVhdHVyZXNbaV0uZ2VvanNvbiA9PSBnZW9qc29uICkgcmV0dXJuIHRoaXMuZmVhdHVyZXNbaV07XG4gICAgfVxuXG4gICAgcmV0dXJuIG51bGw7XG4gIH0sXG5cbiAgcmVuZGVyOiBmdW5jdGlvbihlKSB7XG4gICAgdmFyIHQsIGRpZmZcbiAgICBpZiggdGhpcy5kZWJ1ZyApIHQgPSBuZXcgRGF0ZSgpLmdldFRpbWUoKTtcblxuICAgIHZhciBkaWZmID0gbnVsbDtcbiAgICBpZiggZSAmJiBlLnR5cGUgPT0gJ21vdmUnICkge1xuICAgICAgdmFyIGNlbnRlciA9IHRoaXMuX21hcC5nZXRDZW50ZXIoKTtcblxuICAgICAgdmFyIHB0ID0gdGhpcy5fbWFwLmxhdExuZ1RvQ29udGFpbmVyUG9pbnQoY2VudGVyKTtcbiAgICAgIGlmKCB0aGlzLmxhc3RDZW50ZXJMTCApIHtcbiAgICAgICAgdmFyIGxhc3RYeSA9IHRoaXMuX21hcC5sYXRMbmdUb0NvbnRhaW5lclBvaW50KHRoaXMubGFzdENlbnRlckxMKTtcbiAgICAgICAgZGlmZiA9IHtcbiAgICAgICAgICB4IDogbGFzdFh5LnggLSBwdC54LFxuICAgICAgICAgIHkgOiBsYXN0WHkueSAtIHB0LnlcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICB0aGlzLmxhc3RDZW50ZXJMTCA9IGNlbnRlcjtcbiAgICB9XG5cbiAgICB2YXIgdG9wTGVmdCA9IHRoaXMuX21hcC5jb250YWluZXJQb2ludFRvTGF5ZXJQb2ludChbMCwgMF0pO1xuICAgIEwuRG9tVXRpbC5zZXRQb3NpdGlvbih0aGlzLl9jYW52YXMsIHRvcExlZnQpO1xuXG4gICAgdmFyIGNhbnZhcyA9IHRoaXMuZ2V0Q2FudmFzKCk7XG4gICAgdmFyIGN0eCA9IGNhbnZhcy5nZXRDb250ZXh0KCcyZCcpO1xuXG4gICAgLy8gY2xlYXIgY2FudmFzXG4gICAgY3R4LmNsZWFyUmVjdCgwLCAwLCBjYW52YXMud2lkdGgsIGNhbnZhcy5oZWlnaHQpO1xuXG4gICAgaWYoICF0aGlzLnpvb21pbmcgKSB0aGlzLnJlZHJhdyhkaWZmKTtcblxuICAgIGlmKCB0aGlzLmRlYnVnICkge1xuICAgICAgZGlmZiA9IG5ldyBEYXRlKCkuZ2V0VGltZSgpIC0gdDtcblxuICAgICAgdmFyIGMgPSAwO1xuICAgICAgZm9yKCB2YXIgaSA9IDA7IGkgPCB0aGlzLmZlYXR1cmVzLmxlbmd0aDsgaSsrICkge1xuICAgICAgICBpZiggIXRoaXMuZmVhdHVyZXNbaV0uY2FjaGUuZ2VvWFkgKSBjb250aW51ZTtcbiAgICAgICAgaWYoIEFycmF5LmlzQXJyYXkodGhpcy5mZWF0dXJlc1tpXS5jYWNoZS5nZW9YWSkgKSBjICs9IHRoaXMuZmVhdHVyZXNbaV0uY2FjaGUuZ2VvWFkubGVuZ3RoO1xuICAgICAgfVxuXG4gICAgICBjb25zb2xlLmxvZygnUmVuZGVyZWQgJytjKycgcHRzIGluICcrZGlmZisnbXMnKTtcbiAgICB9XG4gIH0sXG5cbiAgLypcbiAgICByZXR1cm4gbGlzdCBvZiBhbGwgaW50ZXJzZWN0aW5nIGdlb21ldHJ5IHJlZ3JhZGxlc3MgaXMgY3VycmVudGx5IHZpc2libGVcblxuICAgIHB4UmFkaXVzIC0gaXMgZm9yIGxpbmVzIGFuZCBwb2ludHMgb25seS4gIEJhc2ljYWxseSBob3cgZmFyIG9mZiB0aGUgbGluZSBvclxuICAgIG9yIHBvaW50IGEgbGF0bG5nIGNhbiBiZSBhbmQgc3RpbGwgYmUgY29uc2lkZXJlZCBpbnRlcnNlY3RpbmcuICBUaGlzIGlzXG4gICAgZ2l2ZW4gaW4gcHggYXMgaXQgaXMgY29tcGVuc2F0aW5nIGZvciB1c2VyIGludGVudCB3aXRoIG1vdXNlIGNsaWNrIG9yIHRvdWNoLlxuICAgIFRoZSBwb2ludCBtdXN0IGxheSBpbnNpZGUgdG8gcG9seWdvbiBmb3IgYSBtYXRjaC5cbiAgKi9cbiAgZ2V0QWxsSW50ZXJzZWN0aW5nR2VvbWV0cnkgOiBmdW5jdGlvbihsYXRsbmcsIHB4UmFkaXVzKSB7XG4gICAgdmFyIG1wcCA9IHRoaXMudXRpbHMubWV0ZXJzUGVyUHgobGF0bG5nLCB0aGlzLl9tYXApO1xuICAgIHZhciByID0gbXBwICogKHB4UmFkaXVzIHx8IDUpOyAvLyA1IHB4IHJhZGl1cyBidWZmZXI7XG5cbiAgICB2YXIgY2VudGVyID0ge1xuICAgICAgdHlwZSA6ICdQb2ludCcsXG4gICAgICBjb29yZGluYXRlcyA6IFtsYXRsbmcubG5nLCBsYXRsbmcubGF0XVxuICAgIH07XG4gICAgdmFyIHpvb20gPSB0aGlzLl9tYXAuZ2V0Wm9vbSgpO1xuICAgIHZhciBjb250YWluZXJQb2ludCA9IHRoaXMuX21hcC5sYXRMbmdUb0NvbnRhaW5lclBvaW50KGxhdGxuZyk7XG5cbiAgICB2YXIgZjtcbiAgICB2YXIgaW50ZXJzZWN0cyA9IFtdO1xuXG4gICAgZm9yKCB2YXIgaSA9IDA7IGkgPCB0aGlzLmZlYXR1cmVzLmxlbmd0aDsgaSsrICkge1xuICAgICAgZiA9IHRoaXMuZmVhdHVyZXNbaV07XG5cbiAgICAgIGlmKCAhZi5nZW9qc29uLmdlb21ldHJ5ICkgY29udGludWU7XG5cbiAgICAgIC8vIGNoZWNrIHRoZSBib3VuZGluZyBib3ggZm9yIGludGVyc2VjdGlvbiBmaXJzdFxuICAgICAgaWYoICF0aGlzLl9pc0luQm91bmRzKGZlYXR1cmUsIGxhdGxuZykgKSBjb250aW51ZTtcblxuICAgICAgLy8gc2VlIGlmIHdlIG5lZWQgdG8gcmVjYWxjIHRoZSB4LHkgc2NyZWVuIGNvb3JkaW5hdGUgY2FjaGVcbiAgICAgIGlmKCAhZi5jYWNoZSApIHRoaXMuX2NhbGNHZW9YWShmLCB6b29tKTtcbiAgICAgIGVsc2UgaWYoICFmLmNhY2hlLmdlb1hZICkgdGhpcy5fY2FsY0dlb1hZKGYsIHpvb20pO1xuXG4gICAgICBpZiggdGhpcy51dGlscy5nZW9tZXRyeVdpdGhpblJhZGl1cyhmLmdlb2pzb24uZ2VvbWV0cnksIGYuY2FjaGUuZ2VvWFksIGNlbnRlciwgY29udGFpbmVyUG9pbnQsIHIpICkge1xuICAgICAgICBpbnRlcnNlY3RzLnB1c2goZik7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGludGVyc2VjdHM7XG4gIH0sXG5cbiAgLy8gcmV0dXJucyB0cnVlIGlmIGluIGJvdW5kcyBvciB1bmtub3duXG4gIF9pc0luQm91bmRzIDogZnVuY3Rpb24oZmVhdHVyZSwgbGF0bG5nKSB7XG4gICAgaWYoIGZlYXR1cmUuYm91bmRzICkge1xuICAgICAgaWYoIEFycmF5LmlzQXJyYXkoZmVhdHVyZS5ib3VuZHMpICkge1xuXG4gICAgICAgIGZvciggdmFyIGkgPSAwOyBpIDwgZmVhdHVyZS5ib3VuZHMubGVuZ3RoOyBpKysgKSB7XG4gICAgICAgICAgaWYoIGZlYXR1cmUuYm91bmRzW2ldLmNvbnRhaW5zKGxhdGxuZykgKSByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuXG4gICAgICB9IGVsc2UgaWYgKCBmZWF0dXJlLmJvdW5kcy5jb250YWlucyhsYXRsbmcpICkge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfSxcblxuICAvLyBnZXQgdGhlIG1ldGVycyBwZXIgcHggYW5kIGEgY2VydGFpbiBwb2ludDtcbiAgZ2V0TWV0ZXJzUGVyUHggOiBmdW5jdGlvbihsYXRsbmcpIHtcbiAgICByZXR1cm4gdGhpcy51dGlscy5tZXRlcnNQZXJQeChsYXRsbmcsIHRoaXMuX21hcCk7XG4gIH0sXG5cbiAgX2ludGVyc2VjdHMgOiBmdW5jdGlvbihlKSB7XG4gICAgdmFyIHQgPSBuZXcgRGF0ZSgpLmdldFRpbWUoKTtcbiAgICB2YXIgbXBwID0gdGhpcy5nZXRNZXRlcnNQZXJQeChlLmxhdGxuZyk7XG4gICAgdmFyIHIgPSBtcHAgKiA1OyAvLyA1IHB4IHJhZGl1cyBidWZmZXI7XG5cbiAgICB2YXIgY2VudGVyID0ge1xuICAgICAgdHlwZSA6ICdQb2ludCcsXG4gICAgICBjb29yZGluYXRlcyA6IFtlLmxhdGxuZy5sbmcsIGUubGF0bG5nLmxhdF1cbiAgICB9O1xuXG4gICAgdmFyIGY7XG4gICAgdmFyIGludGVyc2VjdHMgPSBbXTtcblxuICAgIGZvciggdmFyIGkgPSAwOyBpIDwgdGhpcy5mZWF0dXJlcy5sZW5ndGg7IGkrKyApIHtcbiAgICAgIGYgPSB0aGlzLmZlYXR1cmVzW2ldO1xuXG4gICAgICBpZiggIWYudmlzaWJsZSApIGNvbnRpbnVlO1xuICAgICAgaWYoICFmLmdlb2pzb24uZ2VvbWV0cnkgKSBjb250aW51ZTtcbiAgICAgIGlmKCAhZi5jYWNoZSApIGNvbnRpbnVlO1xuICAgICAgaWYoICFmLmNhY2hlLmdlb1hZICkgY29udGludWU7XG4gICAgICBpZiggIXRoaXMuX2lzSW5Cb3VuZHMoZiwgZS5sYXRsbmcpICkgY29udGludWU7XG5cbiAgICAgIGlmKCB0aGlzLnV0aWxzLmdlb21ldHJ5V2l0aGluUmFkaXVzKGYuZ2VvanNvbi5nZW9tZXRyeSwgZi5jYWNoZS5nZW9YWSwgY2VudGVyLCBlLmNvbnRhaW5lclBvaW50LCBmLnNpemUgPyAoZi5zaXplICogbXBwKSA6IHIpICkge1xuICAgICAgICBpbnRlcnNlY3RzLnB1c2goZi5nZW9qc29uKTtcbiAgICAgIH1cblxuICAgIH1cblxuICAgIGlmKCBlLnR5cGUgPT0gJ2NsaWNrJyAmJiB0aGlzLm9uQ2xpY2sgKSB7XG4gICAgICB0aGlzLm9uQ2xpY2soaW50ZXJzZWN0cyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdmFyIG1vdXNlb3ZlciA9IFtdLCBtb3VzZW91dCA9IFtdLCBtb3VzZW1vdmUgPSBbXTtcblxuICAgIHZhciBjaGFuZ2VkID0gZmFsc2U7XG4gICAgZm9yKCB2YXIgaSA9IDA7IGkgPCBpbnRlcnNlY3RzLmxlbmd0aDsgaSsrICkge1xuICAgICAgaWYoIHRoaXMuaW50ZXJzZWN0TGlzdC5pbmRleE9mKGludGVyc2VjdHNbaV0pID4gLTEgKSB7XG4gICAgICAgIG1vdXNlbW92ZS5wdXNoKGludGVyc2VjdHNbaV0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY2hhbmdlZCA9IHRydWU7XG4gICAgICAgIG1vdXNlb3Zlci5wdXNoKGludGVyc2VjdHNbaV0pO1xuICAgICAgfVxuICAgIH1cblxuICAgIGZvciggdmFyIGkgPSAwOyBpIDwgdGhpcy5pbnRlcnNlY3RMaXN0Lmxlbmd0aDsgaSsrICkge1xuICAgICAgaWYoIGludGVyc2VjdHMuaW5kZXhPZih0aGlzLmludGVyc2VjdExpc3RbaV0pID09IC0xICkge1xuICAgICAgICBjaGFuZ2VkID0gdHJ1ZTtcbiAgICAgICAgbW91c2VvdXQucHVzaCh0aGlzLmludGVyc2VjdExpc3RbaV0pO1xuICAgICAgfVxuICAgIH1cblxuICAgIHRoaXMuaW50ZXJzZWN0TGlzdCA9IGludGVyc2VjdHM7XG5cbiAgICBpZiggdGhpcy5vbk1vdXNlT3ZlciAmJiBtb3VzZW92ZXIubGVuZ3RoID4gMCApIHRoaXMub25Nb3VzZU92ZXIuY2FsbCh0aGlzLCBtb3VzZW92ZXIsIGUpO1xuICAgIGlmKCB0aGlzLm9uTW91c2VNb3ZlICkgdGhpcy5vbk1vdXNlTW92ZS5jYWxsKHRoaXMsIG1vdXNlbW92ZSwgZSk7IC8vIGFsd2F5cyBmaXJlXG4gICAgaWYoIHRoaXMub25Nb3VzZU91dCAmJiBtb3VzZW91dC5sZW5ndGggPiAwICkgdGhpcy5vbk1vdXNlT3V0LmNhbGwodGhpcywgbW91c2VvdXQsIGUpO1xuXG4gICAgaWYoIHRoaXMuZGVidWcgKSBjb25zb2xlLmxvZygnaW50ZXJzZWN0cyB0aW1lOiAnKyhuZXcgRGF0ZSgpLmdldFRpbWUoKSAtIHQpKydtcycpO1xuXG4gICAgaWYoIGNoYW5nZWQgKSB0aGlzLnJlbmRlcigpO1xuICB9XG59KTtcbiIsIm1vZHVsZS5leHBvcnRzID0ge1xuICBtb3ZlTGluZSA6IGZ1bmN0aW9uKGNvb3JkcywgZGlmZikge1xuICAgIHZhciBpOyBsZW4gPSBjb29yZHMubGVuZ3RoO1xuICAgIGZvciggaSA9IDA7IGkgPCBsZW47IGkrKyApIHtcbiAgICAgIGNvb3Jkc1tpXS54ICs9IGRpZmYueDtcbiAgICAgIGNvb3Jkc1tpXS55ICs9IGRpZmYueTtcbiAgICB9XG4gIH0sXG5cbiAgcHJvamVjdExpbmUgOiBmdW5jdGlvbihjb29yZHMsIG1hcCkge1xuICAgIHZhciB4eUxpbmUgPSBbXTtcblxuICAgIGZvciggdmFyIGkgPSAwOyBpIDwgY29vcmRzLmxlbmd0aDsgaSsrICkge1xuICAgICAgeHlMaW5lLnB1c2gobWFwLmxhdExuZ1RvQ29udGFpbmVyUG9pbnQoW1xuICAgICAgICAgIGNvb3Jkc1tpXVsxXSwgY29vcmRzW2ldWzBdXG4gICAgICBdKSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHh5TGluZTtcbiAgfSxcblxuICBjYWxjQm91bmRzIDogZnVuY3Rpb24oY29vcmRzKSB7XG4gICAgdmFyIHhtaW4gPSBjb29yZHNbMF1bMV07XG4gICAgdmFyIHhtYXggPSBjb29yZHNbMF1bMV07XG4gICAgdmFyIHltaW4gPSBjb29yZHNbMF1bMF07XG4gICAgdmFyIHltYXggPSBjb29yZHNbMF1bMF07XG5cbiAgICBmb3IoIHZhciBpID0gMTsgaSA8IGNvb3Jkcy5sZW5ndGg7IGkrKyApIHtcbiAgICAgIGlmKCB4bWluID4gY29vcmRzW2ldWzFdICkgeG1pbiA9IGNvb3Jkc1tpXVsxXTtcbiAgICAgIGlmKCB4bWF4IDwgY29vcmRzW2ldWzFdICkgeG1heCA9IGNvb3Jkc1tpXVsxXTtcblxuICAgICAgaWYoIHltaW4gPiBjb29yZHNbaV1bMF0gKSB5bWluID0gY29vcmRzW2ldWzBdO1xuICAgICAgaWYoIHltYXggPCBjb29yZHNbaV1bMF0gKSB5bWF4ID0gY29vcmRzW2ldWzBdO1xuICAgIH1cblxuICAgIHZhciBzb3V0aFdlc3QgPSBMLmxhdExuZyh4bWluLS4wMSwgeW1pbi0uMDEpO1xuICAgIHZhciBub3J0aEVhc3QgPSBMLmxhdExuZyh4bWF4Ky4wMSwgeW1heCsuMDEpO1xuXG4gICAgcmV0dXJuIEwubGF0TG5nQm91bmRzKHNvdXRoV2VzdCwgbm9ydGhFYXN0KTtcbiAgfSxcblxuICBnZW9tZXRyeVdpdGhpblJhZGl1cyA6IGZ1bmN0aW9uKGdlb21ldHJ5LCB4eVBvaW50cywgY2VudGVyLCB4eVBvaW50LCByYWRpdXMpIHtcbiAgICBpZiAoZ2VvbWV0cnkudHlwZSA9PSAnUG9pbnQnKSB7XG4gICAgICByZXR1cm4gdGhpcy5wb2ludERpc3RhbmNlKGdlb21ldHJ5LCBjZW50ZXIpIDw9IHJhZGl1cztcbiAgICB9IGVsc2UgaWYgKGdlb21ldHJ5LnR5cGUgPT0gJ0xpbmVTdHJpbmcnICkge1xuXG4gICAgICBmb3IoIHZhciBpID0gMTsgaSA8IHh5UG9pbnRzLmxlbmd0aDsgaSsrICkge1xuICAgICAgICBpZiggdGhpcy5saW5lSW50ZXJzZWN0c0NpcmNsZSh4eVBvaW50c1tpLTFdLCB4eVBvaW50c1tpXSwgeHlQb2ludCwgMykgKSB7XG4gICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH0gZWxzZSBpZiAoZ2VvbWV0cnkudHlwZSA9PSAnUG9seWdvbicgfHwgZ2VvbWV0cnkudHlwZSA9PSAnTXVsdGlQb2x5Z29uJykge1xuICAgICAgcmV0dXJuIHRoaXMucG9pbnRJblBvbHlnb24oY2VudGVyLCBnZW9tZXRyeSk7XG4gICAgfVxuICB9LFxuXG4gIC8vIGh0dHA6Ly9tYXRoLnN0YWNrZXhjaGFuZ2UuY29tL3F1ZXN0aW9ucy8yNzU1MjkvY2hlY2staWYtbGluZS1pbnRlcnNlY3RzLXdpdGgtY2lyY2xlcy1wZXJpbWV0ZXJcbiAgLy8gaHR0cHM6Ly9lbi53aWtpcGVkaWEub3JnL3dpa2kvRGlzdGFuY2VfZnJvbV9hX3BvaW50X3RvX2FfbGluZVxuICAvLyBbbG5nIHgsIGxhdCwgeV1cbiAgbGluZUludGVyc2VjdHNDaXJjbGUgOiBmdW5jdGlvbihsaW5lUDEsIGxpbmVQMiwgcG9pbnQsIHJhZGl1cykge1xuICAgIHZhciBkaXN0YW5jZSA9XG4gICAgICBNYXRoLmFicyhcbiAgICAgICAgKChsaW5lUDIueSAtIGxpbmVQMS55KSpwb2ludC54KSAtICgobGluZVAyLnggLSBsaW5lUDEueCkqcG9pbnQueSkgKyAobGluZVAyLngqbGluZVAxLnkpIC0gKGxpbmVQMi55KmxpbmVQMS54KVxuICAgICAgKSAvXG4gICAgICBNYXRoLnNxcnQoXG4gICAgICAgIE1hdGgucG93KGxpbmVQMi55IC0gbGluZVAxLnksIDIpICsgTWF0aC5wb3cobGluZVAyLnggLSBsaW5lUDEueCwgMilcbiAgICAgICk7XG4gICAgcmV0dXJuIGRpc3RhbmNlIDw9IHJhZGl1cztcbiAgfSxcblxuICAvLyBodHRwOi8vd2lraS5vcGVuc3RyZWV0bWFwLm9yZy93aWtpL1pvb21fbGV2ZWxzXG4gIC8vIGh0dHA6Ly9zdGFja292ZXJmbG93LmNvbS9xdWVzdGlvbnMvMjc1NDUwOTgvbGVhZmxldC1jYWxjdWxhdGluZy1tZXRlcnMtcGVyLXBpeGVsLWF0LXpvb20tbGV2ZWxcbiAgbWV0ZXJzUGVyUHggOiBmdW5jdGlvbihsbCwgbWFwKSB7XG4gICAgdmFyIHBvaW50QyA9IG1hcC5sYXRMbmdUb0NvbnRhaW5lclBvaW50KGxsKTsgLy8gY29udmVydCB0byBjb250YWluZXJwb2ludCAocGl4ZWxzKVxuICAgIHZhciBwb2ludFggPSBbcG9pbnRDLnggKyAxLCBwb2ludEMueV07IC8vIGFkZCBvbmUgcGl4ZWwgdG8geFxuXG4gICAgLy8gY29udmVydCBjb250YWluZXJwb2ludHMgdG8gbGF0bG5nJ3NcbiAgICB2YXIgbGF0TG5nQyA9IG1hcC5jb250YWluZXJQb2ludFRvTGF0TG5nKHBvaW50Qyk7XG4gICAgdmFyIGxhdExuZ1ggPSBtYXAuY29udGFpbmVyUG9pbnRUb0xhdExuZyhwb2ludFgpO1xuXG4gICAgdmFyIGRpc3RhbmNlWCA9IGxhdExuZ0MuZGlzdGFuY2VUbyhsYXRMbmdYKTsgLy8gY2FsY3VsYXRlIGRpc3RhbmNlIGJldHdlZW4gYyBhbmQgeCAobGF0aXR1ZGUpXG4gICAgcmV0dXJuIGRpc3RhbmNlWDtcbiAgfSxcblxuICAvLyBmcm9tIGh0dHA6Ly93d3cubW92YWJsZS10eXBlLmNvLnVrL3NjcmlwdHMvbGF0bG9uZy5odG1sXG4gIHBvaW50RGlzdGFuY2UgOiBmdW5jdGlvbiAocHQxLCBwdDIpIHtcbiAgICB2YXIgbG9uMSA9IHB0MS5jb29yZGluYXRlc1swXSxcbiAgICAgIGxhdDEgPSBwdDEuY29vcmRpbmF0ZXNbMV0sXG4gICAgICBsb24yID0gcHQyLmNvb3JkaW5hdGVzWzBdLFxuICAgICAgbGF0MiA9IHB0Mi5jb29yZGluYXRlc1sxXSxcbiAgICAgIGRMYXQgPSB0aGlzLm51bWJlclRvUmFkaXVzKGxhdDIgLSBsYXQxKSxcbiAgICAgIGRMb24gPSB0aGlzLm51bWJlclRvUmFkaXVzKGxvbjIgLSBsb24xKSxcbiAgICAgIGEgPSBNYXRoLnBvdyhNYXRoLnNpbihkTGF0IC8gMiksIDIpICsgTWF0aC5jb3ModGhpcy5udW1iZXJUb1JhZGl1cyhsYXQxKSlcbiAgICAgICAgKiBNYXRoLmNvcyh0aGlzLm51bWJlclRvUmFkaXVzKGxhdDIpKSAqIE1hdGgucG93KE1hdGguc2luKGRMb24gLyAyKSwgMiksXG4gICAgICBjID0gMiAqIE1hdGguYXRhbjIoTWF0aC5zcXJ0KGEpLCBNYXRoLnNxcnQoMSAtIGEpKTtcbiAgICByZXR1cm4gKDYzNzEgKiBjKSAqIDEwMDA7IC8vIHJldHVybnMgbWV0ZXJzXG4gIH0sXG5cbiAgcG9pbnRJblBvbHlnb24gOiBmdW5jdGlvbiAocCwgcG9seSkge1xuICAgIHZhciBjb29yZHMgPSAocG9seS50eXBlID09IFwiUG9seWdvblwiKSA/IFsgcG9seS5jb29yZGluYXRlcyBdIDogcG9seS5jb29yZGluYXRlc1xuXG4gICAgdmFyIGluc2lkZUJveCA9IGZhbHNlXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBjb29yZHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmICh0aGlzLnBvaW50SW5Cb3VuZGluZ0JveChwLCB0aGlzLmJvdW5kaW5nQm94QXJvdW5kUG9seUNvb3Jkcyhjb29yZHNbaV0pKSkgaW5zaWRlQm94ID0gdHJ1ZVxuICAgIH1cbiAgICBpZiAoIWluc2lkZUJveCkgcmV0dXJuIGZhbHNlXG5cbiAgICB2YXIgaW5zaWRlUG9seSA9IGZhbHNlXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBjb29yZHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmICh0aGlzLnBucG9seShwLmNvb3JkaW5hdGVzWzFdLCBwLmNvb3JkaW5hdGVzWzBdLCBjb29yZHNbaV0pKSBpbnNpZGVQb2x5ID0gdHJ1ZVxuICAgIH1cblxuICAgIHJldHVybiBpbnNpZGVQb2x5XG4gIH0sXG5cbiAgcG9pbnRJbkJvdW5kaW5nQm94IDogZnVuY3Rpb24gKHBvaW50LCBib3VuZHMpIHtcbiAgICByZXR1cm4gIShwb2ludC5jb29yZGluYXRlc1sxXSA8IGJvdW5kc1swXVswXSB8fCBwb2ludC5jb29yZGluYXRlc1sxXSA+IGJvdW5kc1sxXVswXSB8fCBwb2ludC5jb29yZGluYXRlc1swXSA8IGJvdW5kc1swXVsxXSB8fCBwb2ludC5jb29yZGluYXRlc1swXSA+IGJvdW5kc1sxXVsxXSlcbiAgfSxcblxuICBib3VuZGluZ0JveEFyb3VuZFBvbHlDb29yZHMgOiBmdW5jdGlvbihjb29yZHMpIHtcbiAgICB2YXIgeEFsbCA9IFtdLCB5QWxsID0gW11cblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgY29vcmRzWzBdLmxlbmd0aDsgaSsrKSB7XG4gICAgICB4QWxsLnB1c2goY29vcmRzWzBdW2ldWzFdKVxuICAgICAgeUFsbC5wdXNoKGNvb3Jkc1swXVtpXVswXSlcbiAgICB9XG5cbiAgICB4QWxsID0geEFsbC5zb3J0KGZ1bmN0aW9uIChhLGIpIHsgcmV0dXJuIGEgLSBiIH0pXG4gICAgeUFsbCA9IHlBbGwuc29ydChmdW5jdGlvbiAoYSxiKSB7IHJldHVybiBhIC0gYiB9KVxuXG4gICAgcmV0dXJuIFsgW3hBbGxbMF0sIHlBbGxbMF1dLCBbeEFsbFt4QWxsLmxlbmd0aCAtIDFdLCB5QWxsW3lBbGwubGVuZ3RoIC0gMV1dIF1cbiAgfSxcblxuICAvLyBQb2ludCBpbiBQb2x5Z29uXG4gIC8vIGh0dHA6Ly93d3cuZWNzZS5ycGkuZWR1L0hvbWVwYWdlcy93cmYvUmVzZWFyY2gvU2hvcnRfTm90ZXMvcG5wb2x5Lmh0bWwjTGlzdGluZyB0aGUgVmVydGljZXNcbiAgcG5wb2x5IDogZnVuY3Rpb24oeCx5LGNvb3Jkcykge1xuICAgIHZhciB2ZXJ0ID0gWyBbMCwwXSBdXG5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGNvb3Jkcy5sZW5ndGg7IGkrKykge1xuICAgICAgZm9yICh2YXIgaiA9IDA7IGogPCBjb29yZHNbaV0ubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgdmVydC5wdXNoKGNvb3Jkc1tpXVtqXSlcbiAgICAgIH1cbiAgICAgIHZlcnQucHVzaChjb29yZHNbaV1bMF0pXG4gICAgICB2ZXJ0LnB1c2goWzAsMF0pXG4gICAgfVxuXG4gICAgdmFyIGluc2lkZSA9IGZhbHNlXG4gICAgZm9yICh2YXIgaSA9IDAsIGogPSB2ZXJ0Lmxlbmd0aCAtIDE7IGkgPCB2ZXJ0Lmxlbmd0aDsgaiA9IGkrKykge1xuICAgICAgaWYgKCgodmVydFtpXVswXSA+IHkpICE9ICh2ZXJ0W2pdWzBdID4geSkpICYmICh4IDwgKHZlcnRbal1bMV0gLSB2ZXJ0W2ldWzFdKSAqICh5IC0gdmVydFtpXVswXSkgLyAodmVydFtqXVswXSAtIHZlcnRbaV1bMF0pICsgdmVydFtpXVsxXSkpIGluc2lkZSA9ICFpbnNpZGVcbiAgICB9XG5cbiAgICByZXR1cm4gaW5zaWRlXG4gIH0sXG5cbiAgbnVtYmVyVG9SYWRpdXMgOiBmdW5jdGlvbiAobnVtYmVyKSB7XG4gICAgcmV0dXJuIG51bWJlciAqIE1hdGguUEkgLyAxODA7XG4gIH1cbn07XG4iXX0=
