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
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9ncnVudC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJsaWIvc2hhcmVkL2RhdGFzdG9yZS9pbmRleC5qcyIsImxpYi9zaGFyZWQvZmlsZS9pbmRleC5qcyIsImxpYi9zaGFyZWQvZmlsZS9wYXJzZS5qcyIsImxpYi9zaGFyZWQvZmlsZS9wcm9jZXNzLmpzIiwibGliL3NoYXJlZC9maWxlL3NldHVwLmpzIiwibGliL3NoYXJlZC9odWMvaW5kZXguanMiLCJsaWIvc2hhcmVkL2luZGV4LmpzIiwibGliL3NoYXJlZC9sZWFmbGV0L2NhbnZhcy5qcyIsImxpYi9zaGFyZWQvbGVhZmxldC9jYW52YXNQb2ludEZlYXR1cmUuanMiLCJsaWIvc2hhcmVkL2xlYWZsZXQvZHdyYXQuanMiLCJsaWIvc2hhcmVkL2xlYWZsZXQvaW5kZXguanMiLCJsaWIvc2hhcmVkL2xlZ2VuZC9pbmRleC5qcyIsImxpYi9zaGFyZWQvbGVnZW5kL3RlbXBsYXRlLmpzIiwibGliL3NoYXJlZC9saWJyYXJ5L2luZGV4LmpzIiwibGliL3NoYXJlZC9tYXAvZ2VvanNvbi5qcyIsImxpYi9zaGFyZWQvbWFwL2luZGV4LmpzIiwibGliL3NoYXJlZC9tYXJrZXJzL2NvbmZpZy5qcyIsImxpYi9zaGFyZWQvbWFya2Vycy9kcm91Z2h0SWNvbi5qcyIsImxpYi9zaGFyZWQvbWFya2Vycy9pY29uUmVuZGVyZXIuanMiLCJsaWIvc2hhcmVkL21hcmtlcnMvaW5kZXguanMiLCJsaWIvc2hhcmVkL21hcmtlcnMvdXRpbHMuanMiLCJub2RlX21vZHVsZXMvbGVhZmxldC1jYW52YXMtZ2VvanNvbi9zcmMvbGF5ZXIuanMiLCJub2RlX21vZHVsZXMvbGVhZmxldC1jYW52YXMtZ2VvanNvbi9zcmMvdXRpbHMuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4TEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMUtBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pNQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbkNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RCQTtBQUNBO0FBQ0E7QUFDQTs7O0FDSEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUN2SUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNiQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMUhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUMxRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUNsS0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL0NBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDekJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcGhCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsInZhciBkYXRhID0ge1xuICBhbGwgOiBbXSxcbiAgbm9EZW1hbmQgOiBbXSxcbiAgZmVhdHVyZXMgOiBbXVxufTtcblxubW9kdWxlLmV4cG9ydHMuc2V0ID0gZnVuY3Rpb24ocG9pbnRzKSB7XG4gIGRhdGEuYWxsID0gcG9pbnRzO1xuXG4gIHRtcCA9IFtdO1xuICBmb3IoIHZhciBpID0gcG9pbnRzLmxlbmd0aC0xOyBpID49IDA7IGktLSApIHtcbiAgICBpZiggcG9pbnRzW2ldLnByb3BlcnRpZXMuYWxsb2NhdGlvbnMgJiYgcG9pbnRzW2ldLnByb3BlcnRpZXMuYWxsb2NhdGlvbnMubGVuZ3RoID4gMCApIHtcblxuICAgICAgdmFyIGRlbWFuZCA9IHBvaW50c1tpXS5wcm9wZXJ0aWVzLmFsbG9jYXRpb25zWzBdLmRlbWFuZDtcbiAgICAgIGlmKCBkZW1hbmQgIT09IDAgKSB0bXAucHVzaChwb2ludHNbaV0pO1xuICAgIH1cbiAgfVxuICBkYXRhLm5vRGVtYW5kID0gdG1wO1xufTtcblxubW9kdWxlLmV4cG9ydHMuZ2V0ID0gZnVuY3Rpb24obm9EZW1hbmQpIHtcbiAgaWYoIG5vRGVtYW5kICkgcmV0dXJuIGRhdGEubm9EZW1hbmQ7XG4gIHJldHVybiBkYXRhLmFsbDtcbn07XG5cbm1vZHVsZS5leHBvcnRzLmNsZWFyRmVhdHVyZXMgPSBmdW5jdGlvbigpe1xuICBkYXRhLmZlYXR1cmVzID0gW107XG59O1xuXG5tb2R1bGUuZXhwb3J0cy5hZGRGZWF0dXJlID0gZnVuY3Rpb24oZmVhdHVyZSkge1xuICBkYXRhLmZlYXR1cmVzLnB1c2goZmVhdHVyZSk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cy5nZXRGZWF0dXJlcyA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm4gZGF0YS5mZWF0dXJlcztcbn07XG4iLCJ2YXIgcHJvY2VzcyA9IHJlcXVpcmUoJy4vcHJvY2VzcycpO1xuXG52YXIgUVVFUllfU0laRSA9IDEwMDA7XG52YXIgcXVlcnlSb290ID0gJ2h0dHA6Ly9naXNwdWJsaWMud2F0ZXJib2FyZHMuY2EuZ292L2FyY2dpcy9yZXN0L3NlcnZpY2VzL1dhdGVyX1JpZ2h0cy9Qb2ludHNfb2ZfRGl2ZXJzaW9uL01hcFNlcnZlci8wL3F1ZXJ5JztcbnZhciBxdWVyeUFwcElkVmFyID0gJ1dCR0lTLlBvaW50c19vZl9EaXZlcnNpb24uQVBQTF9JRCc7XG52YXIgcXVlcnlMYXRpdHVkZSA9ICdXQkdJUy5Qb2ludHNfb2ZfRGl2ZXJzaW9uLkxBVElUVURFJztcbnZhciBxdWVyeUxvbmdpdHVkZSA9ICdXQkdJUy5Qb2ludHNfb2ZfRGl2ZXJzaW9uLkxPTkdJVFVERSc7XG52YXIgcXVlcnlPdXRmaWVsZHMgPSAgW3F1ZXJ5QXBwSWRWYXIsIHF1ZXJ5TG9uZ2l0dWRlLCBxdWVyeUxhdGl0dWRlXS5qb2luKCcsJyk7XG5cbnZhciBxdWVyeVBhcmFtcyA9IHtcbiAgZiA6ICdqc29uJyxcbiAgd2hlcmUgOiAnJyxcbiAgcmV0dXJuR2VvbWV0cnkgOiAnZmFsc2UnLFxuICBzcGF0aWFsUmVsIDogJ2VzcmlTcGF0aWFsUmVsSW50ZXJzZWN0cycsXG4gIGdlb21ldHJ5IDogJycsXG4gIGdlb21ldHJ5VHlwZSA6ICdlc3JpR2VvbWV0cnlFbnZlbG9wZScsXG4gIGluU1IgOiAnMTAyMTAwJyxcbiAgb3V0RmllbGRzIDogcXVlcnlPdXRmaWVsZHMsXG4gIG91dFNSIDogJzEwMjEwMCdcbn07XG5cbnZhciBIRUFERVJTID0ge1xuICAgIGFwcGxpY2F0aW9uX251bWJlciA6IHtcbiAgICAgICAgcmVxdWlyZWQgOiB0cnVlLFxuICAgICAgICB0eXBlIDogJ3N0cmluZydcbiAgICB9LFxuICAgIGRlbWFuZF9kYXRlIDoge1xuICAgICAgICByZXF1aXJlZCA6IHRydWUsXG4gICAgICAgIHR5cGUgOiAnZGF0ZS1zdHJpbmcnXG4gICAgfSxcbiAgICB3YXRlcnNoZWQgOiB7XG4gICAgICAgIHJlcXVpcmVkIDogZmFsc2UsXG4gICAgICAgIHR5cGUgOiAnc3RyaW5nJ1xuICAgIH0sXG4gICAgc2Vhc29uIDoge1xuICAgICAgICByZXF1aXJlZCA6IGZhbHNlLFxuICAgICAgICB0eXBlIDogJ2Jvb2xlYW4nLFxuICAgIH0sXG4gICAgJ2h1Yy0xMicgOiB7XG4gICAgICAgIHJlcXVpcmVkIDogZmFsc2UsXG4gICAgICAgIHR5cGUgOiAnYm9vbGVhbidcbiAgICB9LFxuICAgIHdhdGVyX3JpZ2h0X3R5cGUgOiB7XG4gICAgICAgIHJlcXVpcmVkIDogZmFsc2UsXG4gICAgICAgIHR5cGUgOiAnc3RyaW5nJ1xuICAgIH0sXG4gICAgcHJpb3JpdHlfZGF0ZSA6IHtcbiAgICAgICAgcmVxdWlyZWQgOiB0cnVlLFxuICAgICAgICB0eXBlIDogJ2RhdGUtc3RyaW5nJ1xuICAgIH0sXG4gICAgcmlwYXJpYW4gOiB7XG4gICAgICAgIHJlcXVpcmVkIDogZmFsc2UsXG4gICAgICAgIHR5cGUgOiAnYm9vbGVhbidcbiAgICB9LFxuICAgIHByZTE5MTQgOiB7XG4gICAgICAgIHJlcXVpcmVkIDogZmFsc2UsXG4gICAgICAgIHR5cGUgOiAnYm9vbGVhbidcbiAgICB9LFxuICAgIGRlbWFuZCA6IHtcbiAgICAgICAgcmVxdWlyZWQgOiB0cnVlLFxuICAgICAgICB0eXBlIDogJ2Zsb2F0J1xuICAgIH0sXG4gICAgYWxsb2NhdGlvbiA6IHtcbiAgICAgICAgcmVxdWlyZWQgOiB0cnVlLFxuICAgICAgICB0eXBlIDogJ2Zsb2F0J1xuICAgIH1cbn07XG5cbnZhciBsb2NhdGlvbnMgPSB7fSwgbWFwLCBkYXRhc3RvcmU7XG5cbmZ1bmN0aW9uIGNyZWF0ZUdlb0pzb24oZGF0YSwgYXR0ck1hcCwgY2FsbGJhY2spIHtcbiAgICAvLyBmaXJzdCBsb2NhdGUgZGF0YVxuICAgICQoJyNmaWxlLWxvY2F0ZScpLmh0bWwoJ0xvY2F0aW5nIGRhdGEuLi4nKTtcblxuICAgIHZhciBpZHMgPSBbXSwga2V5O1xuICAgIHZhciBjb2wgPSBnZXRBdHRyQ29sKCdhcHBsaWNhdGlvbl9udW1iZXInLCBkYXRhLCBhdHRyTWFwKTtcbiAgICBmb3IoIHZhciBpID0gMTsgaSA8IGRhdGEubGVuZ3RoOyBpKysgKSB7XG4gICAgICAgIHZhciBpZCA9IGRhdGFbaV1bY29sXTtcbiAgICAgICAgaWYoICFsb2NhdGlvbnNbaWRdICkgaWRzLnB1c2goZGF0YVtpXVtjb2xdKTtcbiAgICB9XG5cbiAgICBsb2NhdGVEYXRhKDAsIGlkcywgZnVuY3Rpb24oKXtcblxuICAgICAgICAkKCcjZmlsZS1sb2NhdGUnKS5odG1sKCdDcmVhdGluZyBkYXRhLi4uJyk7XG5cbiAgICAgICAgdmFyIGlNYXAgPSB7fTtcbiAgICAgICAgZm9yKCBrZXkgaW4gYXR0ck1hcCApIGlNYXBbYXR0ck1hcFtrZXldXSA9IGtleTtcblxuICAgICAgICB2YXIgZ2VvSnNvbiA9IFtdO1xuICAgICAgICBmb3IoIHZhciBpID0gMTsgaSA8IGRhdGEubGVuZ3RoOyBpKysgKSB7XG4gICAgICAgICAgICBpZiggIWxvY2F0aW9uc1tkYXRhW2ldW2NvbF1dICkgY29udGludWU7XG5cbiAgICAgICAgICAgIHZhciBwID0ge1xuICAgICAgICAgICAgICAgIHR5cGUgOiAnRmVhdHVyZScsXG4gICAgICAgICAgICAgICAgZ2VvbWV0cnkgOiAkLmV4dGVuZCh7fSwgdHJ1ZSwgbG9jYXRpb25zW2RhdGFbaV1bY29sXV0pLFxuICAgICAgICAgICAgICAgIHByb3BlcnRpZXMgOiB7fVxuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgZm9yKCB2YXIgaiA9IDA7IGogPCBkYXRhWzBdLmxlbmd0aDsgaisrICkge1xuICAgICAgICAgICAgICAgIGtleSA9IGRhdGFbMF1bal07XG4gICAgICAgICAgICAgICAgaWYoIGlNYXBba2V5XSApIGtleSA9IGlNYXBba2V5XTtcbiAgICAgICAgICAgICAgICBwLnByb3BlcnRpZXNba2V5XSA9IChIRUFERVJTW2tleV0gJiYgSEVBREVSU1trZXldLnR5cGUgPT0gJ2Zsb2F0JykgPyBwYXJzZUZsb2F0KGRhdGFbaV1bal0pIDogZGF0YVtpXVtqXTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcC5wcm9wZXJ0aWVzLmFsbG9jYXRpb25zID0gW3tcbiAgICAgICAgICAgICAgICBzZWFzb24gOiB0cnVlLFxuICAgICAgICAgICAgICAgIGFsbG9jYXRpb24gOiBwLnByb3BlcnRpZXMuYWxsb2NhdGlvbixcbiAgICAgICAgICAgICAgICBkZW1hbmQgOiBwLnByb3BlcnRpZXMuZGVtYW5kLFxuICAgICAgICAgICAgICAgIGZvcmVjYXN0IDogZmFsc2UsXG4gICAgICAgICAgICAgICAgZGF0ZSA6IHAucHJvcGVydGllcy5kZW1hbmRfZGF0ZSxcbiAgICAgICAgICAgICAgICBwdWJsaWNfaGVhbHRoX2JpbmQgOiBmYWxzZSxcbiAgICAgICAgICAgICAgICB3cmJpbmQgOiBmYWxzZSxcbiAgICAgICAgICAgICAgICByYXRpbyA6IChwLnByb3BlcnRpZXMuZGVtYW5kID4gMCkgPyAocC5wcm9wZXJ0aWVzLmFsbG9jYXRpb24gLyBwLnByb3BlcnRpZXMuZGVtYW5kKSA6IDBcbiAgICAgICAgICAgIH1dO1xuXG4gICAgICAgICAgICBnZW9Kc29uLnB1c2gocCk7XG4gICAgICAgIH1cblxuICAgICAgICBtYXAuY2xlYXJHZW9qc29uTGF5ZXIoKTtcbiAgICAgICAgZGF0YXN0b3JlLnNldChnZW9Kc29uKTtcbiAgICAgICAgbWFwLmdlb2pzb24uYWRkKGdlb0pzb24pO1xuXG4gICAgICAgICQoJyNmaWxlLWxvY2F0ZScpLmh0bWwoJycpO1xuICAgICAgICBjYWxsYmFjaygpO1xuICAgIH0pO1xufVxuXG5mdW5jdGlvbiBnZXRBdHRyQ29sKGF0dHIsIGRhdGEsIG1hcCkge1xuICAgIGlmKCBtYXBbYXR0cl0gKSByZXR1cm4gZGF0YVswXS5pbmRleE9mKG1hcFthdHRyXSk7XG4gICAgcmV0dXJuIGRhdGFbMF0uaW5kZXhPZihhdHRyKTtcbn1cblxuZnVuY3Rpb24gbG9jYXRlRGF0YShpbmRleCwgaWRzLCBjYWxsYmFjaykge1xuXG4gICAgaWYoIGluZGV4KzEgPj0gaWRzLmxlbmd0aCApIHtcbiAgICAgICAgY2FsbGJhY2soKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICB2YXIgaWRHcm91cCA9IFtdO1xuXG4gICAgICAgIHZhciBpID0gMDtcbiAgICAgICAgZm9yKCBpID0gaW5kZXg7IGkgPCBpbmRleCtRVUVSWV9TSVpFOyBpKysgKSB7XG4gICAgICAgICAgICBpZiggaWRzLmxlbmd0aCA9PSBpICkgYnJlYWs7XG4gICAgICAgICAgICBpZEdyb3VwLnB1c2goaWRzW2ldKTtcbiAgICAgICAgfVxuICAgICAgICBpbmRleCArPSBRVUVSWV9TSVpFO1xuICAgICAgICBjb25zb2xlLmxvZyhpbmRleCk7XG5cbiAgICAgICAgdmFyIHBhcmFtcyA9ICQuZXh0ZW5kKHRydWUsIHt9LCBxdWVyeVBhcmFtcyk7XG4gICAgICAgIHBhcmFtcy53aGVyZSA9IHF1ZXJ5QXBwSWRWYXIgKyAnIGluIChcXCcnICsgaWRHcm91cC5qb2luKCdcXCcsXFwnJykgKyAnXFwnKSc7XG5cbiAgICAgICAgJC5wb3N0KHF1ZXJ5Um9vdCwgcGFyYW1zLGZ1bmN0aW9uKHJlc3Ape1xuICAgICAgICAgIHZhciBmLCBpO1xuICAgICAgICAgIGZvciggaSA9IDA7IGkgPCByZXNwLmZlYXR1cmVzLmxlbmd0aDsgaSsrICkge1xuICAgICAgICAgICAgZiA9IHJlc3AuZmVhdHVyZXNbaV0uYXR0cmlidXRlcztcbiAgICAgICAgICAgIGxvY2F0aW9uc1tmW3F1ZXJ5QXBwSWRWYXJdXSA9IHtcbiAgICAgICAgICAgICAgdHlwZTogJ1BvaW50JyxcbiAgICAgICAgICAgICAgY29vcmRpbmF0ZXM6IFtmW3F1ZXJ5TG9uZ2l0dWRlXSwgZltxdWVyeUxhdGl0dWRlXV1cbiAgICAgICAgICAgIH07XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgJCgnI2ZpbGUtbG9jYXRlJykuaHRtbCgnTG9jYXRpbmcgZGF0YSAnKygoaW5kZXgvaWRzLmxlbmd0aCkudG9GaXhlZCgyKSoxMDApKyclLi4uJyk7XG4gICAgICAgICAgbG9jYXRlRGF0YShpbmRleCwgaWRzLCBjYWxsYmFjayk7XG4gICAgICAgIH0sJ2pzb24nKTtcbiAgICB9XG59XG5cblxuXG52YXIgZmlsZSA9IHtcbiAgSEVBREVSUyA6IEhFQURFUlMsXG4gIGluaXQgOiBmdW5jdGlvbihvcHRpb25zKXtcbiAgICBtYXAgPSBvcHRpb25zLm1hcDtcbiAgICBkYXRhc3RvcmUgPSBvcHRpb25zLmRhdGFzdG9yZTtcbiAgICBvcHRpb25zLmZpbGUgPSB0aGlzO1xuXG4gICAgcmVxdWlyZSgnLi9zZXR1cCcpKHByb2Nlc3MpO1xuICAgIHByb2Nlc3MuaW5pdChvcHRpb25zKTtcbiAgfSxcbiAgY3JlYXRlR2VvSnNvbiA6IGNyZWF0ZUdlb0pzb24sXG4gIHByb2Nlc3MgOiBwcm9jZXNzXG59O1xuXG5cbm1vZHVsZS5leHBvcnRzID0gZmlsZTtcbiIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24odHlwZSwgY29udGVudHMsIGNhbGxiYWNrKSB7XG4gICAgaWYoIHR5cGUgPT0gJ3hsc3gnICkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgZnVuY3Rpb24gb25YbHN4Q29tcGxldGUod2Ipe1xuICAgICAgICAgICAgICAgIHNlbGVjdFdvcmtzaGVldCh3Yi5TaGVldE5hbWVzLCBmdW5jdGlvbihzaGVldE5hbWUpe1xuICAgICAgICAgICAgICAgICAgICB2YXIgY3N2ID0gWExTWC51dGlscy5zaGVldF90b19jc3Yod2IuU2hlZXRzW3NoZWV0TmFtZV0pO1xuICAgICAgICAgICAgICAgICAgICAkLmNzdi50b0FycmF5cyhjc3YsIHt9LCBmdW5jdGlvbihlcnIsIGRhdGEpe1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYoIGVyciApIHJldHVybiBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2sobnVsbCwgZGF0YSk7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB2YXIgd29ya2VyID0gbmV3IFdvcmtlcignYm93ZXJfY29tcG9uZW50cy9qcy14bHN4L3hsc3h3b3JrZXIuanMnKTtcbiAgICAgICAgICAgIHdvcmtlci5vbm1lc3NhZ2UgPSBmdW5jdGlvbihlKSB7XG4gICAgICAgICAgICAgICAgc3dpdGNoKGUuZGF0YS50KSB7XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgJ3JlYWR5JzogYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgJ2UnOiBjb25zb2xlLmVycm9yKGUuZGF0YS5kKTsgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgJ3hsc3gnOiBvblhsc3hDb21wbGV0ZShKU09OLnBhcnNlKGUuZGF0YS5kKSk7IGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICB3b3JrZXIucG9zdE1lc3NhZ2Uoe2Q6Y29udGVudHMsYjp0cnVlfSk7XG5cbiAgICAgICAgfSBjYXRjaChlKSB7XG4gICAgICAgICAgICBjYWxsYmFjayhlKTtcbiAgICAgICAgfVxuXG4gICAgfSBlbHNlIGlmKCBpbmZvLmV4dCA9PSAneGxzJyApIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGZ1bmN0aW9uIG9uWGxzQ29tcGxldGUod2Ipe1xuICAgICAgICAgICAgICAgIHNlbGVjdFdvcmtzaGVldCh3Yi5TaGVldE5hbWVzLCBmdW5jdGlvbihzaGVldE5hbWUpe1xuICAgICAgICAgICAgICAgICAgICB2YXIgY3N2ID0gWExTLnV0aWxzLnNoZWV0X3RvX2Nzdih3Yi5TaGVldHNbc2hlZXROYW1lXSk7XG4gICAgICAgICAgICAgICAgICAgICQuY3N2LnRvQXJyYXlzKGNzdiwge30sIGZ1bmN0aW9uKGVyciwgZGF0YSl7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiggZXJyICkgcmV0dXJuIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhudWxsLCBkYXRhKTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHZhciB3b3JrZXIgPSBuZXcgV29ya2VyKCdib3dlcl9jb21wb25lbnRzL2pzLXhscy94bHN3b3JrZXIuanMnKTtcbiAgICAgICAgICAgIHdvcmtlci5vbm1lc3NhZ2UgPSBmdW5jdGlvbihlKSB7XG4gICAgICAgICAgICAgICAgc3dpdGNoKGUuZGF0YS50KSB7XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgJ3JlYWR5JzogYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgJ2UnOiBjb25zb2xlLmVycm9yKGUuZGF0YS5kKTsgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgJ3hsc3gnOiBvblhsc0NvbXBsZXRlKEpTT04ucGFyc2UoZS5kYXRhLmQpKTsgYnJlYWs7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIHdvcmtlci5wb3N0TWVzc2FnZSh7ZDpjb250ZW50cyxiOnRydWV9KTtcblxuICAgICAgICB9IGNhdGNoKGUpIHtcbiAgICAgICAgICAgIGRlYnVnZ2VyO1xuICAgICAgICAgICAgdGhpcy5vbkNvbXBsZXRlKGUsIG51bGwsIGluZm8sIDEsIDEsIGFyciwgY2FsbGJhY2spO1xuICAgICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHZhciBvcHRpb25zID0ge307XG4gICAgICAgICAgICAvL2lmKCBpbmZvLnBhcnNlciA9PSAnY3N2LXRhYicgKSBvcHRpb25zLnNlcGFyYXRvciA9ICdcXHQnO1xuXG4gICAgICAgICAgICAkLmNzdi50b0FycmF5cyhjb250ZW50cywgb3B0aW9ucywgZnVuY3Rpb24oZXJyLCBkYXRhKXtcbiAgICAgICAgICAgICAgICBpZiggZXJyICkgcmV0dXJuIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICAgICAgY2FsbGJhY2sobnVsbCwgZGF0YSk7XG4gICAgICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgICAgICB9IGNhdGNoKGUpIHtcbiAgICAgICAgICAgIGRlYnVnZ2VyO1xuICAgICAgICAgICAgdGhpcy5vbkNvbXBsZXRlKGUsIG51bGwsIGluZm8sIDEsIDEsIGFyciwgY2FsbGJhY2spO1xuICAgICAgICB9XG4gICAgfVxufVxuIiwidmFyIHBhcnNlID0gcmVxdWlyZSgnLi9wYXJzZScpO1xuXG4vLyBuYW1lcyBEV1Iga2VlcHMgdXNpbmcgdGhvdWdoIHdlIGRpc2N1c3NlZCBvdGhlcndpc2UuLi5cbnZhciBwcmV2aW91c0F0dHJNYXAgPSB7XG4gICdhcHBsaWNhdGlvbl9udW1iZXInIDogJ0FwcElEJyxcbiAgJ2RlbWFuZF9kYXRlJyA6ICdQdWxsIERhdGUnLFxuICAncHJpb3JpdHlfZGF0ZSc6ICdGaWxlIERhdGUnXG59O1xuXG52YXIgZmlsZSwgbWFwLCBmaWxlbmFtZSA9ICcnLCBodWM7XG5cbm1vZHVsZS5leHBvcnRzLmluaXQgPSBmdW5jdGlvbihvcHRpb25zKSB7XG4gIGZpbGUgPSBvcHRpb25zLmZpbGU7XG4gIG1hcCA9IG9wdGlvbnMubWFwO1xuICBodWMgPSBvcHRpb25zLmh1Yztcbn07XG5cbi8vIHByb2Nlc3MgYSBmaWxlXG5tb2R1bGUuZXhwb3J0cy5ydW4gPSBmdW5jdGlvbihlKSB7XG4gIGUuc3RvcFByb3BhZ2F0aW9uKCk7XG4gIGUucHJldmVudERlZmF1bHQoKTtcbiAgdmFyIGZpbGVzID0gZS5kYXRhVHJhbnNmZXIgPyBlLmRhdGFUcmFuc2Zlci5maWxlcyA6IGUudGFyZ2V0LmZpbGVzOyAvLyBGaWxlTGlzdCBvYmplY3QuXG5cbiAgaWYoIGZpbGVzLmxlbmd0aCA+IDAgKSB7XG4gICAgJCgnI2ZpbGUtbG9jYXRlJykuaHRtbCgnTG9hZGluZyBmaWxlLi4uJyk7XG4gICAgZmlsZW5hbWUgPSBmaWxlc1swXS5uYW1lO1xuICAgIHJlYWQoZmlsZXNbMF0pO1xuICB9XG59O1xuXG5tb2R1bGUuZXhwb3J0cy5zZXRGaWxlbmFtZSA9IGZ1bmN0aW9uKG5hbWUpIHtcbiAgZmlsZW5hbWUgPSBuYW1lO1xufTtcblxuZnVuY3Rpb24gaW1wb3J0Q29udGVudHModHlwZSwgY29udGVudHMsIGNhbGxiYWNrKSB7XG4gIHBhcnNlKHR5cGUsIGNvbnRlbnRzLCBvbkZpbGVQYXJzZWQpO1xufVxubW9kdWxlLmV4cG9ydHMuaW1wb3J0Q29udGVudHMgPSBpbXBvcnRDb250ZW50cztcblxuZnVuY3Rpb24gb25GaWxlUGFyc2VkKGVyciwgZGF0YSkge1xuICAkKCcjZmlsZS1sb2NhdGUnKS5odG1sKCcnKTtcbiAgbWF0Y2hDb2xzKGRhdGEsIGZ1bmN0aW9uKGNvbE1hcCl7XG5cbiAgICAvLyBub3cgbG9jYXRlIGRhdGEgYW5kIGNyZWF0ZVxuICAgIGZpbGUuY3JlYXRlR2VvSnNvbihkYXRhLCBjb2xNYXAsIHVwZGF0ZVVpUG9zdEltcG9ydCk7XG4gIH0pO1xufVxubW9kdWxlLmV4cG9ydHMub25GaWxlUGFyc2VkID0gb25GaWxlUGFyc2VkO1xuXG5mdW5jdGlvbiB1cGRhdGVVaVBvc3RJbXBvcnQoKSB7XG4gICQoJyNkYXRlLXNlbGVjdGlvbicpLmhpZGUoKTtcbiAgJCgnI2ZpbGUtc2VsZWN0aW9uJykuaHRtbCgnPGEgY2xhc3M9XCJidG4gYnRuLWxpbmtcIiBpZD1cInJlbW92ZS1maWxlLWJ0blwiPicrZmlsZW5hbWUrJyA8aSBjbGFzcz1cImZhIGZhLXRpbWVzXCI+PC9pPjwvYT4nKTtcblxuICAkKCcjcmVtb3ZlLWZpbGUtYnRuJykub24oJ2NsaWNrJyxmdW5jdGlvbigpe1xuICAgIG1hcC5nZW9qc29uLmNsZWFyTGF5ZXIoKTtcbiAgICBodWMuY2xlYXIoKTtcbiAgICAkKCcjZGF0ZS1zZWxlY3Rpb24nKS5zaG93KCk7XG4gICAgJCgnI2ZpbGUtc2VsZWN0aW9uJykuaHRtbCgnJyk7XG4gIH0pO1xuXG4gICQoJyNmaWxlLWlucHV0JykudmFsKCcnKTtcbiAgJCgnI3RvYXN0JykuaGlkZSgpO1xufVxuXG5mdW5jdGlvbiByZWFkKHJhdykge1xuICAgIF9yZXNldFVJKCk7XG5cbiAgICB2YXIgdHlwZSA9ICd0ZXh0JztcblxuICAgIHZhciByZWFkZXIgPSBuZXcgRmlsZVJlYWRlcigpO1xuICAgIHJlYWRlci5vbmxvYWQgPSBmdW5jdGlvbihlKSB7XG4gICAgICAgIGltcG9ydENvbnRlbnRzKHR5cGUsIGUudGFyZ2V0LnJlc3VsdCk7XG4gICAgfTtcblxuICAgIGlmKCByYXcubmFtZS5tYXRjaCgvLipcXC54bHN4PyQvKSApIHtcbiAgICAgICAgdHlwZSA9IHJhdy5uYW1lLnJlcGxhY2UoLy4qXFwuLywnJyk7XG4gICAgICAgIHJlYWRlci5yZWFkQXNCaW5hcnlTdHJpbmcocmF3KTtcbiAgICB9IGVsc2Uge1xuICAgICAgICByZWFkZXIucmVhZEFzVGV4dChyYXcpO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gbWF0Y2hDb2xzKGRhdGEsIGNhbGxiYWNrKSB7XG4gICAgaWYoIGRhdGEubGVuZ3RoID09IDAgKSByZXR1cm4gYWxlcnQoJ1lvdXIgZmlsZSBpcyBlbXB0eScpO1xuXG4gICAgdmFyIG1hdGNoZXMgPSBbXTtcbiAgICB2YXIgcmVxdWlyZWRNaXNtYXRjaGVzID0gW107XG4gICAgdmFyIG1hcHBlZCA9IHByZXZpb3VzQXR0ck1hcDtcblxuICAgIHZhciBmbGF0dGVuID0gW107XG4gICAgZm9yKCB2YXIgaSA9IDA7IGkgPCBkYXRhWzBdLmxlbmd0aDsgaSsrICkge1xuICAgICAgZmxhdHRlbi5wdXNoKGRhdGFbMF1baV0udG9Mb3dlckNhc2UoKSk7XG4gICAgfVxuXG4gICAgZm9yKCB2YXIga2V5IGluIGZpbGUuSEVBREVSUyApIHtcbiAgICAgICAgaWYoIHByZXZpb3VzQXR0ck1hcFtrZXldICYmIGZsYXR0ZW4uaW5kZXhPZihwcmV2aW91c0F0dHJNYXBba2V5XS50b0xvd2VyQ2FzZSgpKSA+IC0xICkge1xuICAgICAgICAgICAgbWF0Y2hlcy5wdXNoKGtleSk7XG4gICAgICAgIH0gZWxzZSBpZiggZmxhdHRlbi5pbmRleE9mKGtleS50b0xvd2VyQ2FzZSgpKSA9PSAtMSAmJiBmaWxlLkhFQURFUlNba2V5XS5yZXF1aXJlZCApIHtcbiAgICAgICAgICAgIHJlcXVpcmVkTWlzbWF0Y2hlcy5wdXNoKGtleSk7XG4gICAgICAgIH0gZWxzZSBpZiggZmxhdHRlbi5pbmRleE9mKGtleS50b0xvd2VyQ2FzZSgpKSA+IC0xICkge1xuICAgICAgICAgIGlmKCBkYXRhWzBdLmluZGV4T2Yoa2V5KSA+IC0xICkge1xuICAgICAgICAgICAgbWF0Y2hlcy5wdXNoKGtleSk7XG4gICAgICAgICAgfSBlbHNlIHsgLy8gdGhlIGNhc2UgZGlmZmVycywgYWRkIGl0IHRvIHRoZSBhdHRyaWJ1dGUgbWFwXG4gICAgICAgICAgICB2YXIgaW5kZXggPSBmbGF0dGVuLmluZGV4T2Yoa2V5LnRvTG93ZXJDYXNlKCkpO1xuICAgICAgICAgICAgcHJldmlvdXNBdHRyTWFwW2tleV0gPSBkYXRhWzBdW2luZGV4XTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAkKCcjZmlsZS1tb2RhbCcpLm1vZGFsKCdoaWRlJyk7XG5cbiAgICBpZiggcmVxdWlyZWRNaXNtYXRjaGVzLmxlbmd0aCA9PSAwICkgcmV0dXJuIGNhbGxiYWNrKHByZXZpb3VzQXR0ck1hcCk7XG5cbiAgICAvLyBtYWtlIHN1cmUgbW9kYWwgaXMgc2hvd2luZ1xuICAgICQoJyNtYXRjaC1tb2RhbCcpLm1vZGFsKCdzaG93Jyk7XG5cbiAgICB2YXIgdGFibGUgPSAnPHRhYmxlIGNsYXNzPVwidGFibGVcIj4nO1xuICAgIGZvciggdmFyIGkgPSAwOyBpIDwgcmVxdWlyZWRNaXNtYXRjaGVzLmxlbmd0aDsgaSsrICkge1xuICAgICAgICB0YWJsZSArPSAnPHRyPjx0ZD4nK3JlcXVpcmVkTWlzbWF0Y2hlc1tpXSsnPC90ZD48dGQ+JytfY3JlYXRlTWF0Y2hTZWxlY3RvcihyZXF1aXJlZE1pc21hdGNoZXNbaV0sIGRhdGFbMF0sIG1hdGNoZXMpKyc8L3RkPjwvdHI+JztcbiAgICB9XG4gICAgdGFibGUgKz0gJzwvdGFibGU+JztcblxuICAgICQoJyNtYXRjaFRhYmxlJykuaHRtbCgnPGRpdiBzdHlsZT1cIm1hcmdpbi10b3A6MjBweDtmb250LXdlaWdodDpib2xkXCI+UGxlYXNlIG1hdGNoIHRoZSBmb2xsb3dpbmcgcmVxdWlyZWQgY29sdW1ucyB0byBjb250aW51ZTwvZGl2PicrdGFibGUpO1xuICAgICQoJy5tYXRjaC1zZWxlY3RvcicpLm9uKCdjaGFuZ2UnLCBmdW5jdGlvbigpe1xuICAgICAgICB2YXIga2V5ID0gJCh0aGlzKS5hdHRyKCdrZXknKTtcbiAgICAgICAgdmFyIHZhbCA9ICQodGhpcykudmFsKCk7XG5cbiAgICAgICAgaWYoIHZhbCA9PSAnJyB8fCAhdmFsICkge1xuICAgICAgICAgICAgZGVsZXRlIG1hcHBlZFtrZXldO1xuICAgICAgICAgICAgcmVxdWlyZWRNaXNtYXRjaGVzLnB1c2goa2V5KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIG1hcHBlZFtrZXldID0gdmFsO1xuICAgICAgICAgICAgdmFyIGluZGV4ID0gcmVxdWlyZWRNaXNtYXRjaGVzLmluZGV4T2Yoa2V5KTtcbiAgICAgICAgICAgIGlmIChpbmRleCA+IC0xKSByZXF1aXJlZE1pc21hdGNoZXMuc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgICAgfVxuXG5cbiAgICAgICAgaWYoIHJlcXVpcmVkTWlzbWF0Y2hlcy5sZW5ndGggPT0gMCApIHtcbiAgICAgICAgICAgICQoJyNtYXRjaC1tb2RhbCcpLm1vZGFsKCdoaWRlJyk7XG4gICAgICAgICAgICAkKCcjbWF0Y2hUYWJsZScpLmh0bWwoJycpO1xuICAgICAgICAgICAgcHJldmlvdXNBdHRyTWFwID0gbWFwcGVkO1xuICAgICAgICAgICAgY2FsbGJhY2sobWFwcGVkKTtcbiAgICAgICAgfVxuICAgIH0pO1xufVxuXG5cbmZ1bmN0aW9uIF9yZXNldFVJKCkge1xuICAgICQoJyNtYXRjaFRhYmxlJykuaHRtbCgnJyk7XG4gICAgJCgnI2ZpbGUtbG9jYXRlJykuaHRtbCgnJyk7XG59XG5cbmZ1bmN0aW9uIF9jcmVhdGVNYXRjaFNlbGVjdG9yKGtleSwgYXJyLCBtYXRjaGVzKSB7XG4gICAgdmFyIHNlbGVjdCA9ICc8c2VsZWN0IGNsYXNzPVwibWF0Y2gtc2VsZWN0b3JcIiBrZXk9XCInK2tleSsnXCI+PG9wdGlvbj48L29wdGlvbj4nO1xuXG4gICAgZm9yKCB2YXIgaSA9IDA7IGkgPCBhcnIubGVuZ3RoOyBpKysgKSB7XG4gICAgICAgIGlmKCBtYXRjaGVzLmluZGV4T2YoYXJyW2ldKSA+IC0xICkgY29udGludWU7XG4gICAgICAgIHNlbGVjdCArPSAnPG9wdGlvbiB2YWx1ZT1cIicrYXJyW2ldKydcIj4nK2FycltpXSsnPC9vcHRpb24+JztcbiAgICB9XG4gICAgcmV0dXJuIHNlbGVjdCArICc8L3NlbGVjdD4nO1xufVxuXG5mdW5jdGlvbiBzZWxlY3RXb3Jrc2hlZXQoc2hlZXROYW1lcywgY2FsbGJhY2spIHtcbiAgICBjb25zb2xlLmxvZyhzaGVldE5hbWVzKTtcblxuICAgIGlmKCBzaGVldE5hbWVzLmxlbmd0aCA9PSAxICkgY2FsbGJhY2soc2hlZXROYW1lc1swXSk7XG5cbiAgICAvLyBhZGQgVUkgaW50ZXJhY3Rpb24gaGVyZVxuICAgIGNhbGxiYWNrKHNoZWV0TmFtZXNbMF0pO1xufVxuIiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihwcm9jZXNzKSB7XG4gICQoJyNjbG9zZS1wb3B1cCcpLm9uKCdjbGljaycsIGZ1bmN0aW9uKCl7XG4gICAgJCgnI2luZm8nKS5yZW1vdmVDbGFzcygnZmFkZUluRG93bicpLmFkZENsYXNzKCdzbGlkZU91dFJpZ2h0Jyk7XG5cbiAgICAvL2xlZ2VuZC5zZWxlY3QobnVsbCk7XG4gICAgc2V0VGltZW91dChmdW5jdGlvbigpe1xuICAgICAgJCgnI2luZm8nKS5oaWRlKCkuYWRkQ2xhc3MoJ2ZhZGVJbkRvd24nKS5yZW1vdmVDbGFzcygnc2xpZGVPdXRSaWdodCcpO1xuICAgIH0sIDgwMCk7XG4gIH0pO1xuXG4gIC8vIGZpbGUgdXBsb2FkIHN0dWZmXG4gICQoJyNmaWxlLW1vZGFsJykubW9kYWwoe3Nob3c6ZmFsc2V9KTtcbiAgJCgnI2ZpbGUtaW5wdXQnKS5vbignY2hhbmdlJywgZnVuY3Rpb24oZSkge1xuICAgIHByb2Nlc3MucnVuKGUpO1xuICB9KTtcbiAgJCgnI3VwbG9hZC1idG4nKS5vbignY2xpY2snLCBmdW5jdGlvbigpe1xuICAgICQoJyNmaWxlLW1vZGFsJykubW9kYWwoJ3Nob3cnKTtcbiAgfSk7XG5cbiAgJCgnYm9keScpLm9uKCdkcmFnb3ZlcicsIGZ1bmN0aW9uKGUpe1xuICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuXG4gICAgJCgnI3VwbG9hZC1kcm9wLW1lc3NhZ2UnKS5zaG93KCk7XG4gICAgJCgnI3dyYXBwZXInKS5jc3MoJ29wYWNpdHknLCAwLjMpO1xuICB9KS5vbignZHJhZ2xlYXZlJywgZnVuY3Rpb24oZSl7XG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XG5cbiAgICAkKCcjdXBsb2FkLWRyb3AtbWVzc2FnZScpLmhpZGUoKTtcbiAgICAkKCcjd3JhcHBlcicpLmNzcygnb3BhY2l0eScsMSk7XG4gIH0pLm9uKCdkcm9wJywgZnVuY3Rpb24oZSl7XG4gICAgJCgnI3VwbG9hZC1kcm9wLW1lc3NhZ2UnKS5oaWRlKCk7XG4gICAgJCgnI3dyYXBwZXInKS5jc3MoJ29wYWNpdHknLDEpO1xuXG4gICAgcHJvY2Vzcy5ydW4oZS5vcmlnaW5hbEV2ZW50KTtcbiAgICAkKCcjZmlsZS1tb2RhbCcpLm1vZGFsKCdzaG93Jyk7XG5cbiAgfSk7XG59O1xuIiwidmFyIG1hcmtlckNvbmZpZyA9IHJlcXVpcmUoJy4uL21hcmtlcnMvY29uZmlnJyk7XG5cbnZhciBtYXA7XG52YXIgbGF5ZXJzID0gW107XG52YXIgcG9pbnRzQnlIdWMgPSB7fTtcbnZhciB1cmxQcmVmaXggPSAnaHR0cDovL3dhdGVyc2hlZC5pY2UudWNkYXZpcy5lZHUvdml6c291cmNlL3Jlc3Q/dmlldz1nZXRfaHVjX2J5X2lkKFxcJyc7XG52YXIgdXJsUG9zdGl4ID0gJ1xcJykmdHE9U0VMRUNUIConO1xuXG52YXIgbG9va3VwVXJsID0gJ2h0dHA6Ly9hdGxhcy5jd3MudWNkYXZpcy5lZHUvYXJjZ2lzL3Jlc3Qvc2VydmljZXMvV2F0ZXJzaGVkcy9NYXBTZXJ2ZXIvMC9xdWVyeT8nO1xudmFyIGxvb2t1cFBhcmFtcyA9IHtcbiAgICB3aGVyZSA6ICcnLFxuICAgIGdlb21ldHJ5VHlwZSA6ICdlc3JpR2VvbWV0cnlFbnZlbG9wZScsXG4gICAgc3BhdGlhbFJlbCA6ICdlc3JpU3BhdGlhbFJlbEludGVyc2VjdHMnLFxuICAgIG91dEZpZWxkcyA6ICcqJyxcbiAgICByZXR1cm5HZW9tZXRyeSA6ICd0cnVlJyxcbiAgICBvdXRTUiA6ICc0MzI2JyxcbiAgICBmIDogJ3Bqc29uJ1xufTtcblxudmFyIGh1Y0NhY2hlID0ge307XG52YXIgcmVxdWVzdGVkID0ge307XG5cbnZhciBzaG93aW5nID0gdHJ1ZTtcbnZhciBjdXJyZW50UG9pbnRzID0gbnVsbDtcblxuZnVuY3Rpb24gaW5pdChvcHRpb25zKSB7XG4gIG1hcCA9IG9wdGlvbnMubWFwLmdldExlYWZsZXQoKTtcblxuICAkKCcjcmVuZGVySHVjQXZnJykub24oJ2NoYW5nZScsIGZ1bmN0aW9uKCl7XG4gICAgc2hvd2luZyA9ICQodGhpcykuaXMoJzpjaGVja2VkJyk7XG4gICAgb25WaXNpYmlsaXR5VXBkYXRlKHNob3dpbmcpO1xuICB9KTtcbn1cblxuZnVuY3Rpb24gb25WaXNpYmlsaXR5VXBkYXRlKCkge1xuICBpZiggIXNob3dpbmcgKSB7XG4gICAgY2xlYXIoKTtcbiAgfSBlbHNlIGlmKCBjdXJyZW50UG9pbnRzICE9PSBudWxsICl7XG4gICAgcmVuZGVyKGN1cnJlbnRQb2ludHMpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGNsZWFyKCkge1xuICAvLyBjbGVhciBhbGwgbGF5ZXJzXG4gIGZvciggdmFyIGkgPSAwOyBpIDwgbGF5ZXJzLmxlbmd0aDsgaSsrICkge1xuICAgIG1hcC5yZW1vdmVMYXllcihsYXllcnNbaV0pO1xuICB9XG4gIGxheWVycyA9IFtdO1xuICBwb2ludHNCeUh1YyA9IHt9O1xufVxuXG5mdW5jdGlvbiByZW5kZXIocG9pbnRzKSB7XG4gIGN1cnJlbnRQb2ludHMgPSBwb2ludHM7XG4gIGlmKCAhc2hvd2luZyApIHJldHVybjtcblxuICBjbGVhcigpO1xuXG4gIC8vIG9yZ2FuaXplIHBvaW50cyBieSBodWNcbiAgdmFyIGh1YztcbiAgZm9yKCB2YXIgaSA9IDA7IGkgPCBjdXJyZW50UG9pbnRzLmxlbmd0aDsgaSsrICkge1xuICAgIC8vIFRPRE86IGRpZCBxdWlubiBjaGFuZ2UgdGhpcz9cbiAgICBodWMgPSBwb2ludHNbaV0ucHJvcGVydGllc1snaHVjLTEyJ10gfHwgcG9pbnRzW2ldLnByb3BlcnRpZXMuaHVjXzEyO1xuXG4gICAgaWYoIHBvaW50c0J5SHVjW2h1Y10gKSBwb2ludHNCeUh1Y1todWNdLnB1c2gocG9pbnRzW2ldKTtcbiAgICBlbHNlIHBvaW50c0J5SHVjW2h1Y10gPSBbcG9pbnRzW2ldXTtcbiAgfVxuXG4gIC8vIHJlcXVlc3QgbWlzc2luZyBodWMgZ2VvanNvbiBhbmQvb3IgcmVuZGVyIGh1Y1xuICBmb3IoIHZhciBodWMgaW4gcG9pbnRzQnlIdWMgKSB7XG4gICAgaWYoIGh1YyA9PT0gdW5kZWZpbmVkIHx8IGh1YyA9PT0gJ3VuZGVmaW5lZCcgKSB7XG4gICAgICBkZWJ1Z2dlcjtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIGlmKCBodWNDYWNoZVtodWNdICkgcmVuZGVySHVjKGh1Yyk7XG4gICAgZWxzZSBpZiggIXJlcXVlc3RlZFtodWNdICkgcmVxdWVzdChodWMpO1xuICB9XG59XG5cbmZ1bmN0aW9uIHJlcXVlc3QoaHVjSWQpIHtcbiAgcmVxdWVzdGVkW2h1Y0lkXSA9IDE7XG5cbiAgdmFyIHBhcmFtcyA9ICQuZXh0ZW5kKHRydWUsIHt9LCBsb29rdXBQYXJhbXMpO1xuICBwYXJhbXMud2hlcmUgPSAnSFVDXzEyID0gXFwnJytodWNJZCsnXFwnJztcbiAgdmFyIHBhcmFtVGV4dCA9IFtdO1xuICBmb3IoIHZhciBrZXkgaW4gcGFyYW1zICkge1xuICAgIHBhcmFtVGV4dC5wdXNoKGtleSsnPScrZW5jb2RlVVJJQ29tcG9uZW50KHBhcmFtc1trZXldKSk7XG4gIH1cbiAgJC5nZXQobG9va3VwVXJsK3BhcmFtVGV4dC5qb2luKCcmJyksIG9uTG9va3VwUmVzcG9uc2UpO1xuXG4gIC8qdmFyIHF1ZXJ5ID0gbmV3IGdvb2dsZS52aXN1YWxpemF0aW9uLlF1ZXJ5KHVybFByZWZpeCtodWNJZCt1cmxQb3N0aXgpO1xuICBxdWVyeS5zZXRUaW1lb3V0KDYwKjUpOyAvLyA1IG1pbiB0aW1lb3V0XG4gIHF1ZXJ5LnNlbmQoZnVuY3Rpb24ocmVzcG9uc2Upe1xuICAgIGlmIChyZXNwb25zZS5pc0Vycm9yKCkgKSByZXR1cm4gYWxlcnQoJ0Vycm9yIHJldHJpZXZpbmcgSFVDIDEyIGRhdGEgZm9yIGlkIFwiJytodWNJZCsnXCInKTtcblxuICAgIHZhciBkYXRhID0gcmVzcG9uc2UuZ2V0RGF0YVRhYmxlKCk7XG5cbiAgICBpZiggZGF0YS5nZXROdW1iZXJPZlJvd3MoKSA9PSAwICkge1xuICAgICAgZGVidWdnZXI7XG4gICAgICByZXR1cm4gYWxlcnQoJ0Vycm9yOiBpbnZhbGlkIEhVQyAxMiBpZCBcIicraHVjSWQrXCInXCIpO1xuICAgIH1cblxuICAgIHZhciBnZW9tZXRyeSA9IEpTT04ucGFyc2UoZGF0YS5nZXRWYWx1ZSgwLCAwKSk7XG4gICAgdmFyIGdlb2pzb25GZWF0dXJlID0ge1xuICAgICAgXCJ0eXBlXCI6IFwiRmVhdHVyZVwiLFxuICAgICAgXCJwcm9wZXJ0aWVzXCI6IHtcbiAgICAgICAgICBcImlkXCI6IGh1Y0lkLFxuICAgICAgfSxcbiAgICAgIFwiZ2VvbWV0cnlcIjogZ2VvbWV0cnlcbiAgICB9O1xuICAgIGh1Y0NhY2hlW2h1Y0lkXSA9IGdlb2pzb25GZWF0dXJlO1xuXG4gICAgcmVuZGVySHVjKGh1Y0lkKTtcbiAgfSk7Ki9cbn1cblxuZnVuY3Rpb24gb25Mb29rdXBSZXNwb25zZShyZXNwKSB7XG4gIGlmKCB0eXBlb2YgcmVzcCA9PT0gJ3N0cmluZycgKSB7XG4gICAgcmVzcCA9IEpTT04ucGFyc2UocmVzcCk7XG4gIH1cblxuICBpZiggcmVzcC5mZWF0dXJlcyAmJiByZXNwLmZlYXR1cmVzLmxlbmd0aCA+IDAgKSB7XG4gICAgdmFyIGZlYXR1cmUgPSByZXNwLmZlYXR1cmVzWzBdO1xuXG5cbiAgICB2YXIgZ2VvanNvbiA9IHtcbiAgICAgICd0eXBlJzogJ0ZlYXR1cmUnLFxuICAgICAgJ3Byb3BlcnRpZXMnOiBmZWF0dXJlLmF0dHJpYnV0ZXMsXG4gICAgICAnZ2VvbWV0cnknOiB7XG4gICAgICAgIHR5cGUgOiAnUG9seWdvbicsXG4gICAgICAgIGNvb3JkaW5hdGVzIDogZmVhdHVyZS5nZW9tZXRyeS5yaW5nc1xuICAgICAgfVxuICAgIH07XG5cbiAgICBnZW9qc29uLnByb3BlcnRpZXMuaWQgPSBnZW9qc29uLnByb3BlcnRpZXMuSFVDXzEyO1xuXG4gICAgaHVjQ2FjaGVbZ2VvanNvbi5wcm9wZXJ0aWVzLmlkXSA9IGdlb2pzb247XG4gICAgaWYoICFnZW9qc29uLnByb3BlcnRpZXMuaWQgKSB7XG4gICAgICBjb25zb2xlLmxvZygnYmFkIHJlc3BvbnNlIGxvb2tpbmcgdXAgSFVDOicpO1xuICAgICAgY29uc29sZS5sb2coZmVhdHVyZSk7XG4gICAgfVxuXG4gICAgcmVuZGVySHVjKGdlb2pzb24ucHJvcGVydGllcy5pZCk7XG4gIH1cbn1cblxuZnVuY3Rpb24gcmVuZGVySHVjKGlkKSB7XG4gIGlmKCAhc2hvd2luZyApIHJldHVybjtcblxuICB2YXIgcG9pbnRzID0gcG9pbnRzQnlIdWNbaWRdO1xuXG4gIGlmKCAhcG9pbnRzICkge1xuICAgIGFsZXJ0KCdVbmFibGVkIHRvIGxvb2t1cCBwb2ludHMgZm9yIEhVQzogJytpZCk7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgLy8gY2FsY3VsYXRlIHBlcmNlbnQgZGVtYW5kXG4gIHZhciBwZXJjZW50RGVtYW5kcyA9IFtdLCBmZWF0dXJlO1xuICBmb3IoIHZhciBpID0gMDsgaSA8IHBvaW50cy5sZW5ndGg7IGkrKyApIHtcbiAgICBmZWF0dXJlID0gcG9pbnRzW2ldO1xuXG4gICAgaWYoIGZlYXR1cmUucHJvcGVydGllcy5hbGxvY2F0aW9ucyAmJiBmZWF0dXJlLnByb3BlcnRpZXMuYWxsb2NhdGlvbnMubGVuZ3RoID4gMCApIHtcbiAgICAgIHZhciBkZW1hbmQgPSBmZWF0dXJlLnByb3BlcnRpZXMuYWxsb2NhdGlvbnNbMF0uZGVtYW5kO1xuICAgICAgdmFyIGFsbG9jYXRpb24gPSBmZWF0dXJlLnByb3BlcnRpZXMuYWxsb2NhdGlvbnNbMF0uYWxsb2NhdGlvbjtcblxuICAgICAgaWYoIGRlbWFuZCAhPSAwICkge1xuICAgICAgICBwZXJjZW50RGVtYW5kcy5wdXNoKGFsbG9jYXRpb24gLyBkZW1hbmQpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8vIGNhbGMgYXZlcmFnZVxuICB2YXIgYXZnUHJlY2VudERlbWFuZCA9IC0xO1xuICB2YXIgdG1wID0gMDtcbiAgZm9yKCB2YXIgaSA9IDA7IGkgPCBwZXJjZW50RGVtYW5kcy5sZW5ndGg7IGkrKyApIHtcbiAgICB0bXAgKz0gcGVyY2VudERlbWFuZHNbaV07XG4gIH1cbiAgaWYoIHBlcmNlbnREZW1hbmRzLmxlbmd0aCA+IDAgKSBhdmdQcmVjZW50RGVtYW5kID0gdG1wIC8gcGVyY2VudERlbWFuZHMubGVuZ3RoO1xuXG4gIHZhciBsYXllciA9IEwuZ2VvSnNvbihcbiAgICBodWNDYWNoZVtpZF0sXG4gICAge1xuICAgICAgc3R5bGU6IGZ1bmN0aW9uKGZlYXR1cmUpIHtcbiAgICAgICAgcmV0dXJuIG1hcmtlckNvbmZpZy5wZXJjZW50RGVtYW5kSHVjKGF2Z1ByZWNlbnREZW1hbmQpO1xuICAgICAgfVxuICAgIH1cbiAgKS5hZGRUbyhtYXApO1xuXG4gIGxheWVycy5wdXNoKGxheWVyKTtcbn1cblxuZnVuY3Rpb24gZ2V0Q2FjaGUoKSB7XG4gIHJldHVybiBodWNDYWNoZTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gIGluaXQgOiBpbml0LFxuICByZW5kZXIgOiByZW5kZXIsXG4gIGNsZWFyIDogY2xlYXIsXG4gIGdldENhY2hlIDogZ2V0Q2FjaGVcbn07XG4iLCJyZXF1aXJlKCcuL2xlYWZsZXQnKTsgLy8gaW1wb3J0IGN1c3RvbSBtYXJrZXJzIHRvIGxlYWZsZXQgbmFtZXNwYWNlIChnbG9iYWwpXG52YXIgbWFwID0gcmVxdWlyZSgnLi9tYXAnKTtcbnZhciBodWMgPSByZXF1aXJlKCcuL2h1YycpO1xudmFyIGZpbGUgPSByZXF1aXJlKCcuL2ZpbGUnKTtcbnZhciBkaXJlY3RvcnkgPSByZXF1aXJlKCcuL2xpYnJhcnknKTtcbnZhciBkYXRhc3RvcmUgPSByZXF1aXJlKCcuL2RhdGFzdG9yZScpO1xuXG5cbnZhciBtYXAsIGdlb0pzb25MYXllcjtcbnZhciB3bXNMYXllcnMgPSBbXTtcbnZhciBhbGxEYXRhID0gW107XG5cbi8vIHNob3VsZCBiZSBmaWxsZWQgb3IgZW1wdHk7XG52YXIgcmVuZGVyRGVtYW5kID0gJ2VtcHR5JztcbnZhciBjdXJyZW50UG9pbnRzID0gbnVsbDtcbnZhciBsYXN0UmVzcFBvaW50cyA9IG51bGw7XG5cbiQoZG9jdW1lbnQpLm9uKCdyZWFkeScsIGZ1bmN0aW9uKCl7XG4gIHJlc2l6ZSgpO1xuICBpbml0KCk7XG59KTtcblxuJCh3aW5kb3cpXG4gIC5vbigncmVzaXplJywgcmVzaXplKTtcblxuZnVuY3Rpb24gaW5pdCgpIHtcbiAgdmFyIGNvbmZpZyA9IHtcbiAgICBkYXRhc3RvcmUgOiBkYXRhc3RvcmUsXG4gICAgbWFwIDogbWFwLFxuICAgIGh1YyA6IGh1Y1xuICB9O1xuXG4gIG1hcC5pbml0KGNvbmZpZyk7XG4gIGh1Yy5pbml0KGNvbmZpZyk7XG4gIGZpbGUuaW5pdChjb25maWcpO1xuICBkaXJlY3RvcnkuaW5pdChjb25maWcpO1xuXG4gIC8vIHF1aWNrbHkgbG9hZHMgL3Rlc3RkYXRhL1NhY1JpdmVyLmNzdiBmb3IgdGVzdGluZ1xuICAvLyByZXF1aXJlKCcuL3Rlc3QnKShmaWxlKTtcbn1cblxuZnVuY3Rpb24gcmVzaXplKCkge1xuICB2YXIgaCA9IHdpbmRvdy5pbm5lckhlaWdodDtcbiAgdmFyIHcgPSB3aW5kb3cuaW5uZXJXaWR0aDtcbiAgaWYoIGggPT09IG51bGwgKSBoID0gJCh3aW5kb3cpLmhlaWdodCgpO1xuICBpZiggdyA9PT0gbnVsbCApIHcgPSAkKHdpbmRvdykud2lkdGgoKTtcblxuICAkKCcjbWFwJykuaGVpZ2h0KGgpLndpZHRoKHcpO1xuICAkKCcjaW5mbycpLmNzcygnbWF4LWhlaWdodCcsIChoLTg1KSsncHgnKTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gIG1hcCA6IG1hcCxcbiAgaHVjIDogaHVjLFxuICBmaWxlIDogZmlsZSxcbiAgZGlyZWN0b3J5IDogZGlyZWN0b3J5LFxuICBkcyA6IGRhdGFzdG9yZVxufTtcbiIsInZhciBJY29uUmVuZGVyZXIgPSByZXF1aXJlKCcuLi9tYXJrZXJzL2ljb25SZW5kZXJlcicpO1xuXG5MLkljb24uQ2FudmFzID0gTC5JY29uLmV4dGVuZCh7XG4gICAgb3B0aW9uczoge1xuICAgICAgICBpY29uU2l6ZTogbmV3IEwuUG9pbnQoMjAsIDIwKSwgLy8gSGF2ZSB0byBiZSBzdXBwbGllZFxuICAgICAgICBjbGFzc05hbWU6ICdsZWFmbGV0LWNhbnZhcy1pY29uJ1xuICAgIH0sXG5cbiAgICBjcmVhdGVJY29uOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnY2FudmFzJyk7XG4gICAgICAgIHRoaXMuX3NldEljb25TdHlsZXMoZSwgJ2ljb24nKTtcblxuICAgICAgICBlLndpZHRoID0gdGhpcy5vcHRpb25zLndpZHRoO1xuICAgICAgICBlLmhlaWdodCA9IHRoaXMub3B0aW9ucy5oZWlnaHQ7XG5cbiAgICAgICAgZS5zdHlsZS5tYXJnaW5Ub3AgPSAoLTEqdGhpcy5vcHRpb25zLndpZHRoLzIpKydweCc7XG4gICAgICAgIGUuc3R5bGUubWFyZ2luTGVmdCA9ICgtMSp0aGlzLm9wdGlvbnMuaGVpZ2h0LzIpKydweCc7XG5cbiAgICAgICAgZS5zdHlsZS53aWR0aCA9IHRoaXMub3B0aW9ucy53aWR0aCsncHgnO1xuICAgICAgICBlLnN0eWxlLmhlaWdodCA9dGhpcy5vcHRpb25zLmhlaWdodCsncHgnO1xuXG4gICAgICAgIHRoaXMuZHJhdyhlLmdldENvbnRleHQoJzJkJykpO1xuXG4gICAgICAgIHJldHVybiBlO1xuICAgIH0sXG5cbiAgICBjcmVhdGVTaGFkb3c6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfSxcblxuXG4gICAgZHJhdzogZnVuY3Rpb24oY3R4KSB7XG4gICAgICBJY29uUmVuZGVyZXIoY3R4LCB0aGlzLm9wdGlvbnMpO1xuICAgIH1cbn0pO1xuIiwidmFyIG1hcmtlckNvbmZpZyA9IHJlcXVpcmUoJy4uL21hcmtlcnMvY29uZmlnJyk7XG52YXIgSWNvblJlbmRlcmVyID0gcmVxdWlyZSgnLi4vbWFya2Vycy9pY29uUmVuZGVyZXInKTtcbnZhciBtYXJrZXJzID0gbWFya2VyQ29uZmlnLmRlZmF1bHRzO1xuXG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24ocG9pbnQpIHtcblxuICB2YXIgdHlwZSA9IHBvaW50LnByb3BlcnRpZXMucmlwYXJpYW4gPyAncmlwYXJpYW4nIDogJ2FwcGxpY2F0aW9uJztcbiAgdmFyIGFsbG9jYXRpb24gPSAndW5hbGxvY2F0ZWQnO1xuXG4gIGZvciggdmFyIGkgPSAwOyBpIDwgcG9pbnQucHJvcGVydGllcy5hbGxvY2F0aW9ucy5sZW5ndGg7IGkrKyApIHtcbiAgICBpZiggcG9pbnQucHJvcGVydGllcy5hbGxvY2F0aW9uc1tpXS5hbGxvY2F0aW9uID4gMCApIGFsbG9jYXRpb24gPSAnYWxsb2NhdGVkJztcbiAgfVxuXG4gIHZhciBvcHRpb25zID0gJC5leHRlbmQodHJ1ZSwge30sIG1hcmtlcnNbdHlwZV1bYWxsb2NhdGlvbl0pO1xuXG4gIGlmKCBwb2ludC5wcm9wZXJ0aWVzLmFsbG9jYXRpb25zICYmIHBvaW50LnByb3BlcnRpZXMuYWxsb2NhdGlvbnMubGVuZ3RoID4gMCApIHtcblxuICAgIHZhciBkZW1hbmQgPSBwb2ludC5wcm9wZXJ0aWVzLmFsbG9jYXRpb25zWzBdLmRlbWFuZDtcbiAgICBhbGxvY2F0aW9uID0gcG9pbnQucHJvcGVydGllcy5hbGxvY2F0aW9uc1swXS5hbGxvY2F0aW9uO1xuXG4gICAgaWYoIGRlbWFuZCA9PT0gMCApIHtcblxuICAgICAgJC5leHRlbmQodHJ1ZSwgb3B0aW9ucywgbWFya2Vycy5ub0RlbWFuZCk7XG4gICAgICBwb2ludC5wcm9wZXJ0aWVzLm5vRGVtYW5kID0gdHJ1ZTtcblxuICAgIH0gZWxzZSB7XG4gICAgICBtYXJrZXJDb25maWcucGVyY2VudERlbWFuZChvcHRpb25zLCBhbGxvY2F0aW9uIC8gZGVtYW5kKTtcblxuICAgICAgdmFyIHNpemUgPSBNYXRoLnNxcnQoZGVtYW5kKSAqIDM7XG4gICAgICBpZiggc2l6ZSA+IDUwICkgc2l6ZSA9IDUwO1xuICAgICAgaWYoIHNpemUgPCA3ICkgc2l6ZSA9IDc7XG5cbiAgICAgIG9wdGlvbnMuaGVpZ2h0ID0gc2l6ZSoyO1xuICAgICAgb3B0aW9ucy53aWR0aCA9IHNpemUqMjtcbiAgICB9XG4gIH1cblxuICB2YXIgbWFya2VyO1xuICB2YXIgZCA9IDE5NzE7XG4gIHRyeSB7XG4gICAgaWYoIHR5cGVvZiBwb2ludC5wcm9wZXJ0aWVzLnByaW9yaXR5X2RhdGUgPT09ICdzdHJpbmcnICkge1xuICAgICAgZCA9IHBvaW50LnByb3BlcnRpZXMucHJpb3JpdHlfZGF0ZSA/IHBhcnNlSW50KHBvaW50LnByb3BlcnRpZXMucHJpb3JpdHlfZGF0ZS5yZXBsYWNlKC8tLiovLCcnKSkgOiAyMDAwO1xuICAgIH0gZWxzZSBpZiAoIHR5cGVvZiBwb2ludC5wcm9wZXJ0aWVzLnByaW9yaXR5X2RhdGUgPT09ICdvYmplY3QnKSB7XG4gICAgICBkID0gcG9pbnQucHJvcGVydGllcy5wcmlvcml0eV9kYXRlLmdldFllYXIoKSsxOTAwO1xuICAgIH1cbiAgfSBjYXRjaChlKSB7XG4gICAgZCA9IDE5NzE7XG4gIH1cblxuXG5cbiAgaWYoIHBvaW50LnByb3BlcnRpZXMucmlwYXJpYW4gKSB7XG4gICAgcG9pbnQucHJvcGVydGllcy5fcmVuZGVyZWRfYXMgPSAnUmlwYXJpYW4nO1xuICAgIG9wdGlvbnMuc2lkZXMgPSAwO1xuICAgIC8vbWFya2VyID0gTC5kd3JhdE1hcmtlcihsYXRsbmcsIG9wdGlvbnMpO1xuICB9IGVsc2UgaWYgKCBkIDwgMTkxNCApIHtcbiAgICBwb2ludC5wcm9wZXJ0aWVzLl9yZW5kZXJlZF9hcyA9ICdQcmUtMTkxNCBBcHByb3ByaWF0aXZlJztcbiAgICBvcHRpb25zLnNpZGVzID0gMztcbiAgICBvcHRpb25zLnJvdGF0ZSA9IDkwO1xuICAgIC8vbWFya2VyID0gTC5kd3JhdE1hcmtlcihsYXRsbmcsIG9wdGlvbnMpO1xuICB9IGVsc2Uge1xuICAgIHBvaW50LnByb3BlcnRpZXMuX3JlbmRlcmVkX2FzID0gJ1Bvc3QtMTkxNCBBcHByb3ByaWF0aXZlJztcbiAgICAvL21hcmtlciA9IEwuZHdyYXRNYXJrZXIobGF0bG5nLCBvcHRpb25zKTtcbiAgfVxuXG4gIHBvaW50LnByb3BlcnRpZXMuX3JlbmRlciA9IG9wdGlvbnM7XG5cbiAgcmV0dXJuIHtcbiAgICAgIGdlb2pzb24gOiBwb2ludCxcbiAgICAgIHNpemUgOiBvcHRpb25zLndpZHRoLzIsXG4gICAgICByZW5kZXIgOiByZW5kZXJcbiAgfTtcbn07XG5cbmZ1bmN0aW9uIHJlbmRlcihjdHgsIHh5UG9pbnRzLCBtYXApIHtcbiAgSWNvblJlbmRlcmVyKGN0eCwgdGhpcy5nZW9qc29uLnByb3BlcnRpZXMuX3JlbmRlciwgeHlQb2ludHMpO1xufVxuIiwidmFyIEljb25SZW5kZXJlciA9IHJlcXVpcmUoJy4uL21hcmtlcnMvaWNvblJlbmRlcmVyJyk7XG5cbkwuZHdyYXRNYXJrZXIgPSBmdW5jdGlvbiAobGF0bG5nLCBvcHRpb25zKSB7XG4gIHZhciBtYXJrZXIgPSBuZXcgTC5NYXJrZXIobGF0bG5nLCB7XG4gICAgICBpY29uOiBuZXcgTC5JY29uLkNhbnZhcyhvcHRpb25zKSxcbiAgICAgIGljb25TaXplOiBuZXcgTC5Qb2ludChvcHRpb25zLndpZHRoLCBvcHRpb25zLmhlaWdodCksXG4gIH0pO1xuXG4gIG1hcmtlci5zZXRTdHlsZSA9IGZ1bmN0aW9uKG9wdGlvbnMpIHtcbiAgICB2YXIgbyA9IHRoaXMub3B0aW9ucy5pY29uLm9wdGlvbnM7XG5cbiAgICAkLmV4dGVuZCh0cnVlLCBvLCBvcHRpb25zKTtcbiAgICBpZiggIXRoaXMuX2ljb24gKSByZXR1cm47XG5cbiAgICB2YXIgY3R4ID0gdGhpcy5faWNvbi5nZXRDb250ZXh0KCcyZCcpO1xuICAgIGN0eC5jbGVhclJlY3QoMCwgMCwgby53aWR0aCwgby5oZWlnaHQpO1xuXG4gICAgSWNvblJlbmRlcmVyKGN0eCwgbyk7XG4gIH07XG5cbiAgcmV0dXJuIG1hcmtlcjtcbn07XG4iLCJyZXF1aXJlKCcuL2NhbnZhcycpO1xucmVxdWlyZSgnLi9kd3JhdCcpO1xucmVxdWlyZSgnLi4vLi4vLi4vbm9kZV9tb2R1bGVzL2xlYWZsZXQtY2FudmFzLWdlb2pzb24vc3JjL2xheWVyLmpzJyk7XG4iLCJ2YXIgRHJvdWdodEljb24gPSByZXF1aXJlKCcuLi9tYXJrZXJzL2Ryb3VnaHRJY29uJyk7XG52YXIgbWFya2VyQ29uZmlnID0gcmVxdWlyZSgnLi4vbWFya2Vycy9jb25maWcnKTtcbnZhciBtYXJrZXJUZW1wbGF0ZSA9IHJlcXVpcmUoJy4vdGVtcGxhdGUnKTtcbnZhciBtYXJrZXJzID0gbWFya2VyQ29uZmlnLmRlZmF1bHRzO1xudmFyIG1hcCwgZGF0YXN0b3JlO1xuXG5nbG9iYWwuc2V0dGluZ3MgPSB7XG4gIHJlbmRlckRlbWFuZCA6ICdlbXB0eSdcbn07XG5cbm1vZHVsZS5leHBvcnRzLmluaXQgPSBmdW5jdGlvbihjb25maWcpIHtcbiAgbWFwID0gY29uZmlnLm1hcDtcbiAgZGF0YXN0b3JlID0gY29uZmlnLmRhdGFzdG9yZTtcblxuICB2YXIgZGVtYW5kU3RlcHMgPSBbMCwgMSwgNTAsIDEwMCwgMjUwXTtcblxuICB2YXIgb3B0aW9ucyA9ICQuZXh0ZW5kKHRydWUsIHt9LCBtYXJrZXJzLnJpcGFyaWFuLnVuYWxsb2NhdGVkKTtcbiAgb3B0aW9ucy5zaWRlcyA9IDA7XG4gIHZhciBpY29uID0gbmV3IERyb3VnaHRJY29uKG9wdGlvbnMpO1xuICAkKCcjbGVnZW5kLXJpcGFyaWFuJykuYXBwZW5kKCQoaWNvbi5lbGUpKTtcblxuXG4gIG9wdGlvbnMgPSAkLmV4dGVuZCh0cnVlLCB7fSwgbWFya2Vycy5hcHBsaWNhdGlvbi51bmFsbG9jYXRlZCk7XG4gIG9wdGlvbnMuc2lkZXMgPSAzO1xuICBvcHRpb25zLnJvdGF0ZSA9IDkwO1xuICBpY29uID0gbmV3IERyb3VnaHRJY29uKG9wdGlvbnMpO1xuICAkKCcjbGVnZW5kLXByZS1hcHByb3ByaWF0aXZlJykuYXBwZW5kKCQoaWNvbi5lbGUpKTtcblxuICBpY29uID0gbmV3IERyb3VnaHRJY29uKG1hcmtlcnMuYXBwbGljYXRpb24udW5hbGxvY2F0ZWQpO1xuICAkKCcjbGVnZW5kLXBvc3QtYXBwcm9wcmlhdGl2ZScpLmFwcGVuZCgkKGljb24uZWxlKSk7XG5cbiAgdmFyIHRhYmxlID0gJzx0YWJsZSBzdHlsZT1cInRleHQtYWxpZ246Y2VudGVyXCI+PHRyIHN0eWxlPVwidmVydGljYWwtYWxpZ246IGJvdHRvbVwiPic7XG4gIHZhciBpY29ucyA9IFtdO1xuICBmb3IoIHZhciBpID0gMDsgaSA8IGRlbWFuZFN0ZXBzLmxlbmd0aDsgaSsrICkge1xuICAgIHRhYmxlICs9ICc8dGQgc3R5bGU9XCJwYWRkaW5nOjRweFwiPjxkaXYgaWQ9XCJsZWdlbmQtZGVtYW5kLScraSsnXCI+PC9kaXY+PGRpdj4nK1xuICAgICAgICAgICAgICAoZGVtYW5kU3RlcHNbaV0gPT0gMSA/ICc8JyA6ICcnKSArXG4gICAgICAgICAgICAgIChkZW1hbmRTdGVwc1tpXSA9PSAyNTAgPyAnPicgOiAnJykgK1xuICAgICAgICAgICAgICBkZW1hbmRTdGVwc1tpXSsnPC9kaXY+PC90ZD4nO1xuXG5cbiAgICBpZiggZGVtYW5kU3RlcHNbaV0gPT09IDAgKSB7XG4gICAgICBvcHRpb25zID0gJC5leHRlbmQodHJ1ZSwge30sIG1hcmtlcnMuYXBwbGljYXRpb24udW5hbGxvY2F0ZWQpO1xuICAgICAgb3B0aW9ucyA9ICQuZXh0ZW5kKHRydWUsIG9wdGlvbnMsIG1hcmtlcnMubm9EZW1hbmQpO1xuICAgIH0gZWxzZSB7XG4gICAgICBvcHRpb25zID0gJC5leHRlbmQodHJ1ZSwge30sIG1hcmtlcnMuYXBwbGljYXRpb24udW5hbGxvY2F0ZWQpO1xuXG4gICAgICB2YXIgc2l6ZSA9IE1hdGguc3FydChkZW1hbmRTdGVwc1tpXSkgKiAzO1xuICAgICAgaWYoIHNpemUgPiA1MCApIHNpemUgPSA1MDtcbiAgICAgIGlmKCBzaXplIDwgNyApIHNpemUgPSA3O1xuXG4gICAgICBvcHRpb25zLmhlaWdodCA9IChzaXplKjIpKzI7XG4gICAgICBvcHRpb25zLndpZHRoID0gKHNpemUqMikrMjtcbiAgICB9XG5cbiAgICBpY29ucy5wdXNoKG5ldyBEcm91Z2h0SWNvbihvcHRpb25zKSk7XG4gIH1cbiAgJCgnI2xlZ2VuZC1kZW1hbmQnKS5odG1sKHRhYmxlKyc8L3RyPjwvdGFibGU+Jyk7XG5cbiAgZm9yKCBpID0gMDsgaSA8IGljb25zLmxlbmd0aDsgaSsrICkge1xuICAgICQoJyNsZWdlbmQtZGVtYW5kLScraSkuYXBwZW5kKCQoaWNvbnNbaV0uZWxlKSk7XG4gIH1cblxuICB0aGlzLnJlZHJhd1BEZW1hbmRMZWdlbmQoKTtcblxuICAvLyBpbml0IHRvZ2dsZSBidXR0b25cblxuICAkKCcjbGVnZW5kVG9nZ2xlJykub24oJ2NsaWNrJywgZnVuY3Rpb24oKXtcbiAgICBpZiggdGhpcy5oYXNBdHRyaWJ1dGUoJ3Nob3dpbmcnKSApIHtcbiAgICAgIHRoaXMucmVtb3ZlQXR0cmlidXRlKCdzaG93aW5nJyk7XG4gICAgICAkKCcjbGVnZW5kJykuaGlkZSgnc2xvdycpO1xuICAgICAgdGhpcy5pbm5lckhUTUwgPSAnPGkgY2xhc3M9XCJmYSBmYS1hcnJvdy1yaWdodFwiPjwvaT4nO1xuXG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuc2V0QXR0cmlidXRlKCdzaG93aW5nJywgJycpO1xuICAgICAgJCgnI2xlZ2VuZCcpLnNob3coJ3Nsb3cnKTtcbiAgICAgIHRoaXMuaW5uZXJIVE1MID0gJzxpIGNsYXNzPVwiZmEgZmEtYXJyb3ctZG93blwiPjwvaT4nO1xuICAgIH1cbiAgfSk7XG5cbiAgJCgnI3JlbmRlclR5cGVGaWxsZWQnKS5vbignY2xpY2snLCBvblJlbmRlclR5cGVDaGFuZ2UpO1xuICAkKCcjcmVuZGVyVHlwZUVtcHR5Jykub24oJ2NsaWNrJywgb25SZW5kZXJUeXBlQ2hhbmdlKTtcblxuICAkKCcjc2hvd05vRGVtYW5kJykub24oJ2NsaWNrJywgZnVuY3Rpb24oKXtcbiAgICBtYXAuZ2VvanNvbi5jbGVhckxheWVyKCk7XG4gICAgdmFyIG5vRGVtYW5kID0gISQodGhpcykuaXMoJzpjaGVja2VkJyk7XG4gICAgbWFwLmdlb2pzb24uYWRkKGRhdGFzdG9yZS5nZXQobm9EZW1hbmQpKTtcbiAgfSk7XG59O1xuXG5mdW5jdGlvbiByZWRyYXdQRGVtYW5kTGVnZW5kKCkge1xuICB2YXIgcGVyY2VudFN0ZXBzID0gWzAsIDI1LCA1MCwgNzUsIDEwMF0sIGk7XG5cbiAgdmFyIHRhYmxlID0gJzx0YWJsZSBzdHlsZT1cInRleHQtYWxpZ246Y2VudGVyXCI+PHRyIHN0eWxlPVwidmVydGljYWwtYWxpZ246IGJvdHRvbVwiPic7XG4gIHZhciBpY29ucyA9IFtdO1xuXHRmb3IoIGkgPSAwOyBpIDwgcGVyY2VudFN0ZXBzLmxlbmd0aDsgaSsrICkge1xuXHRcdHRhYmxlICs9ICc8dGQgc3R5bGU9XCJwYWRkaW5nOjhweFwiPjxkaXYgaWQ9XCJsZWdlbmQtcHJlY2VudC1vZi1kZW1hbmQtJytpKydcIj48L2Rpdj48ZGl2PicrXG5cdFx0XHRcdFx0cGVyY2VudFN0ZXBzW2ldKyclPC9kaXY+PC90ZD4nO1xuXG5cdFx0dmFyIG9wdGlvbnMgPSAkLmV4dGVuZCh0cnVlLCB7fSwgbWFya2Vycy5hcHBsaWNhdGlvbi51bmFsbG9jYXRlZCk7XG5cbiAgICBtYXJrZXJDb25maWcucGVyY2VudERlbWFuZChvcHRpb25zLCBwZXJjZW50U3RlcHNbaV0gLyAxMDApO1xuXG5cdFx0aWNvbnMucHVzaChuZXcgRHJvdWdodEljb24ob3B0aW9ucykpO1xuXHR9XG5cdCQoJyNsZWdlbmQtcHJlY2VudC1vZi1kZW1hbmQnKS5odG1sKHRhYmxlKyc8L3RyPjwvdGFibGU+Jyk7XG5cblx0Zm9yKCBpID0gMDsgaSA8IGljb25zLmxlbmd0aDsgaSsrICkge1xuXHRcdCQoJyNsZWdlbmQtcHJlY2VudC1vZi1kZW1hbmQtJytpKS5hcHBlbmQoJChpY29uc1tpXS5lbGUpKTtcblx0fVxufTtcbm1vZHVsZS5leHBvcnRzLnJlZHJhd1BEZW1hbmRMZWdlbmQgPSByZWRyYXdQRGVtYW5kTGVnZW5kO1xuXG5mdW5jdGlvbiBvblJlbmRlclR5cGVDaGFuZ2UoKSB7XG4gIHZhciBzZXR0aW5ncyA9IGdsb2JhbC5zZXR0aW5ncztcbiAgdmFyIGlzRmlsbGVkQ2hlY2tlZCA9ICQoJyNyZW5kZXJUeXBlRmlsbGVkJykuaXMoJzpjaGVja2VkJyk7XG4gIHZhciBuZXdWYWwgPSBpc0ZpbGxlZENoZWNrZWQgPyAnZmlsbGVkJyA6ICdlbXB0eSc7XG5cbiAgaWYoIHNldHRpbmdzLnJlbmRlckRlbWFuZCA9PSBuZXdWYWwgKSByZXR1cm47XG4gIHNldHRpbmdzLnJlbmRlckRlbWFuZCA9IG5ld1ZhbDtcblxuICAvLyByZW5kZXIgbGVnZW5kXG4gIHJlZHJhd1BEZW1hbmRMZWdlbmQoKTtcblxuICBpZiggIWN1cnJlbnRQb2ludHMgKSByZXR1cm47XG5cbiAgbWFwLmdlb2pzb24uY2xlYXJMYXllcigpO1xuICB2YXIgbm9EZW1hbmQgPSAhJCh0aGlzKS5pcygnOmNoZWNrZWQnKTtcbiAgbWFwLmdlb2pzb24uYWRkKGRhdGFzdG9yZS5nZXQobm9EZW1hbmQpKTtcbn1cblxubW9kdWxlLmV4cG9ydHMuc3RhbXAgPSBmdW5jdGlvbihkYXRhKSB7XG4gIHZhciB0ZW1wbGF0ZSA9IG1hcmtlclRlbXBsYXRlO1xuICBmb3IoIHZhciBrZXkgaW4gZGF0YSApIHRlbXBsYXRlID0gdGVtcGxhdGUucmVwbGFjZSgne3snK2tleSsnfX0nLCBkYXRhW2tleV0pO1xuICByZXR1cm4gdGVtcGxhdGU7XG59O1xuIiwibW9kdWxlLmV4cG9ydHMgPSBcbiAgJzxkaXYgY2xhc3M9XCJzcGFjZXJcIj48L2Rpdj4nK1xuICAnPGgzPldhdGVyIFJpZ2h0L0NsYWltICM6IHt7YXBwbGljYXRpb25fbnVtYmVyfX08L2gzPicrXG4gICc8ZGl2IHN0eWxlPVwibWFyZ2luOjE1cHhcIj4nK1xuICAgICc8Yj5Gb3I6PC9iPiB7e2RhdGV9fTxiciAvPicrXG4gICAgJzxiPkFsbG9jYXRpb246PC9iPiB7e2FsbG9jYXRpb259fSBbQWMtZnQvZGF5XTxiciAvPicrXG4gICAgJzxiPkRlbWFuZDo8L2I+IHt7ZGVtYW5kfX0gW0FjLWZ0L2RheV0nK1xuICAgICc8YnIgLz48Yj5QZXJjZW50IG9mIERlbWFuZDogPC9iPnt7cmF0aW99fSU8YnIgLz4nK1xuICAgICc8ZGl2IGNsYXNzPVwid2VsbCB3ZWxsLXNtXCIgc3R5bGU9XCJtYXJnaW4tdG9wOjVweFwiPicrXG4gICAgJ3t7d2F0ZXJfcmlnaHRfdHlwZX19PGJyIC8+JytcbiAgICAnPGI+UHJpb3JpdHkgRGF0ZTo8L2I+IHt7cHJpb3JpdHlfZGF0ZX19JytcbiAgICAnPC9kaXY+JytcbiAgJzwvZGl2Pic7XG4iLCJ2YXIgZmlsZXMgPSBbXTtcblxudmFyIHJvb3QgPSAnaHR0cHM6Ly9kb2NzLmdvb2dsZS5jb20vc3ByZWFkc2hlZXRzL2QvMUFDaTdQMHBPeS1KUmp0dzZIcmliUXBoaEVPWi0wLUNrUV9tcW55Q2ZKY0kvZ3Zpei90cSc7XG52YXIgcG9wdXAsIGJvZHksIGZpbGUsIG1hcCwgdG9hc3Q7XG5cbmZ1bmN0aW9uIGluaXQoY29uZmlnKSB7XG4gIGZpbGUgPSBjb25maWcuZmlsZTtcbiAgbWFwID0gY29uZmlnLm1hcDtcblxuICB2YXIgcXVlcnkgPSBuZXcgZ29vZ2xlLnZpc3VhbGl6YXRpb24uUXVlcnkocm9vdCk7XG4gIHF1ZXJ5LnNlbmQob25Jbml0TG9hZCk7XG5cbiAgcG9wdXAgPSAkKCcjZGlyZWN0b3J5LW1vZGFsJykubW9kYWwoe3Nob3c6IGZhbHNlfSk7XG4gIGJvZHkgPSAkKCcjZGlyZWN0b3J5LW1vZGFsLWJvZHknKTtcblxuICAkKCcjZGlyZWN0b3J5LWJ0bicpLm9uKCdjbGljaycsIGZ1bmN0aW9uKCl7XG4gICAgcG9wdXAubW9kYWwoJ3Nob3cnKTtcbiAgfSk7XG5cbiAgdG9hc3QgPSAkKCc8ZGl2IHN0eWxlPVwiZGlzcGxheTpub25lO3Bvc2l0aW9uOmZpeGVkO2xlZnQ6MTBweDsgYm90dG9tOiA1MHB4XCIgY2xhc3M9XCJhbmltYXRlZCBmYWRlSW5VcFwiIGlkPVwidG9hc3RcIj48ZGl2IGNsYXNzPVwiYWxlcnQgYWxlcnQtc3VjY2Vzc1wiPjxpIGNsYXNzPVwiZmEgZmEtc3Bpbm5lciBmYS1zcGluXCI+PC9pPiBMb2FkaW5nIEZpbGUuLi48L2Rpdj48L2Rpdj4nKTtcbiAgJCgnYm9keScpLmFwcGVuZCh0b2FzdCk7XG59XG5cbmZ1bmN0aW9uIG9uSW5pdExvYWQocmVzcCkge1xuICBpZiAocmVzcC5pc0Vycm9yKCkpIHtcbiAgICBhbGVydCgnRXJyb3IgaW4gbG9hZGluZyBwdWJsaWMgZGlyZWN0b3J5IGxpc3Rpbmc6ICcgKyByZXNwb25zZS5nZXRNZXNzYWdlKCkgKyAnICcgKyByZXNwb25zZS5nZXREZXRhaWxlZE1lc3NhZ2UoKSk7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgdmFyIGRhdGEgPSByZXNwLmdldERhdGFUYWJsZSgpO1xuICB2YXIgcm93TGVuID0gZGF0YS5nZXROdW1iZXJPZlJvd3MoKTtcbiAgdmFyIGNvbExlbiA9IGRhdGEuZ2V0TnVtYmVyT2ZDb2x1bW5zKCk7XG5cbiAgdmFyIHRhYmxlID0gJzxoND5TZWxlY3QgRmlsZSB0byBMb2FkPC9oND48dGFibGUgY2xhc3M9XCJ0YWJsZVwiPic7XG4gIHRhYmxlICs9ICc8dHI+PHRoPkZpbGVuYW1lPC90aD48dGg+U3RhcnQgRGF0ZTwvdGg+PHRoPkVuZCBEYXRlPC90aD48dGQ+PC90ZD48L3RyPic7XG4gIGZvciggdmFyIGkgPSAwOyBpIDwgcm93TGVuOyBpKysgKSB7XG4gICAgdmFyIGZpbGUgPSB7fTtcbiAgICBmb3IoIHZhciBqID0gMDsgaiA8IGNvbExlbjsgaisrICkge1xuICAgICAgZmlsZVtkYXRhLmdldENvbHVtbkxhYmVsKGopXSA9IGRhdGEuZ2V0VmFsdWUoaSwgaik7XG4gICAgfVxuXG4gICAgdGFibGUgKz0gZmlsZVRvUm93KGZpbGUsIGkpO1xuXG4gICAgZmlsZXMucHVzaChmaWxlKTtcbiAgfVxuXG4gIGJvZHlcbiAgICAuaHRtbCh0YWJsZSsnPC90YWJsZT4nKVxuICAgIC5maW5kKCdhW2luZGV4XScpXG4gICAgLm9uKCdjbGljaycsIGZ1bmN0aW9uKCl7XG4gICAgICB2YXIgZmlsZSA9IGZpbGVzW3BhcnNlSW50KCQodGhpcykuYXR0cignaW5kZXgnKSldO1xuICAgICAgbG9hZChmaWxlLlJlZ2lvbisnICcrZ2V0RGF0ZXMoZmlsZSksIGZpbGUuSUQpO1xuICAgICAgcG9wdXAubW9kYWwoJ2hpZGUnKTtcbiAgICB9KTtcbn1cblxuZnVuY3Rpb24gZ2V0RGF0ZXMoZmlsZSkge1xuICBpZiggIWZpbGVbJ1N0YXJ0IERhdGUnXSB8fCAhZmlsZVsnRW5kIERhdGUnXSApIHJldHVybiAnJztcblxuICB2YXIgdHh0ID0gJygnO1xuICB0eHQgKz0gZmlsZVsnU3RhcnQgRGF0ZSddID8gdG9EYXRlKGZpbGVbJ1N0YXJ0IERhdGUnXSkgOiAnPyc7XG4gIHR4dCArPSAnIC0gJztcbiAgdHh0ICs9IGZpbGVbJ0VuZCBEYXRlJ10gPyB0b0RhdGUoZmlsZVsnRW5kIERhdGUnXSkgOiAnPyc7XG4gIHJldHVybiB0eHQgKyAnKSc7XG5cbn1cblxuZnVuY3Rpb24gbG9hZChuYW1lLCBpZCkge1xuICB0b2FzdC5zaG93KCk7XG5cbiAgdmFyIHF1ZXJ5ID0gbmV3IGdvb2dsZS52aXN1YWxpemF0aW9uLlF1ZXJ5KCdodHRwczovL2RvY3MuZ29vZ2xlLmNvbS9zcHJlYWRzaGVldHMvZC8nK2lkKycvZ3Zpei90cScpO1xuICBxdWVyeS5zZW5kKGZ1bmN0aW9uKHJlc3Ape1xuICAgIGlmIChyZXNwLmlzRXJyb3IoKSkge1xuICAgICAgdG9hc3QuaGlkZSgpO1xuICAgICAgYWxlcnQoJ0Vycm9yIGluIGxvYWRpbmcgcHVibGljIHNoZWV0OiAnICsgcmVzcG9uc2UuZ2V0TWVzc2FnZSgpICsgJyAnICsgcmVzcG9uc2UuZ2V0RGV0YWlsZWRNZXNzYWdlKCkpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHZhciBkYXRhID0gcmVzcC5nZXREYXRhVGFibGUoKTtcbiAgICB2YXIgcm93TGVuID0gZGF0YS5nZXROdW1iZXJPZlJvd3MoKTtcbiAgICB2YXIgY29sTGVuID0gZGF0YS5nZXROdW1iZXJPZkNvbHVtbnMoKTtcbiAgICB2YXIgY3N2ID0gW1tdXTtcblxuXG4gICAgZm9yKCB2YXIgaSA9IDA7IGkgPCBjb2xMZW47IGkrKyApIHtcbiAgICAgIGNzdlswXS5wdXNoKGRhdGEuZ2V0Q29sdW1uTGFiZWwoaSkpO1xuICAgIH1cblxuICAgIGZvciggdmFyIGkgPSAwOyBpIDwgcm93TGVuOyBpKysgKSB7XG4gICAgICB2YXIgcm93ID0gW107XG4gICAgICBmb3IoIHZhciBqID0gMDsgaiA8IGNvbExlbjsgaisrICkge1xuICAgICAgICByb3cucHVzaChkYXRhLmdldFZhbHVlKGksIGopKTtcbiAgICAgIH1cbiAgICAgIGNzdi5wdXNoKHJvdyk7XG4gICAgfVxuXG4gICAgZmlsZS5wcm9jZXNzLnNldEZpbGVuYW1lKG5hbWUpO1xuICAgIGZpbGUucHJvY2Vzcy5vbkZpbGVQYXJzZWQobnVsbCwgY3N2KTtcbiAgfSk7XG59XG5cbmZ1bmN0aW9uIGZpbGVUb1JvdyhmaWxlLCBpbmRleCkge1xuICByZXR1cm4gJzx0cj4nICtcbiAgICAnPHRkPjxhIGNsYXNzPVwiYnRuIGJ0bi1saW5rXCIgaW5kZXg9XCInK2luZGV4KydcIj48aSBjbGFzcz1cImZhIGZhLWRvd25sb2FkXCI+PC9pPiAnK2ZpbGUuUmVnaW9uKyc8L2E+PC90ZD4nK1xuICAgICc8dGQ+JytnZXREYXRlKGZpbGVbJ1N0YXJ0IERhdGUnXSkrJzwvdGQ+JytcbiAgICAnPHRkPicrZ2V0RGF0ZShmaWxlWydFbmQgRGF0ZSddKSsnPC90ZD4nK1xuICAgICc8dGQ+PGEgY2xhc3M9XCJidG4gYnRuLWxpbmtcIiBocmVmPVwiaHR0cHM6Ly9kb2NzLmdvb2dsZS5jb20vc3ByZWFkc2hlZXRzL2QvJytmaWxlLklEKydcIiB0YXJnZXQ9XCJfYmxhbmtcIj48aSBjbGFzcz1cImZhIGZhLXRhYmxlXCI+PC9pPjwvYT48L3RkPicrXG4gICc8L3RyPic7XG59XG5cbmZ1bmN0aW9uIGdldERhdGUoZCkge1xuICBpZiggIWQgKSByZXR1cm4gJz8nO1xuICByZXR1cm4gdG9EYXRlKGQpO1xufVxuXG5mdW5jdGlvbiB0b0RhdGUoZCkge1xuICByZXR1cm4gKGQuZ2V0WWVhcigpKzE5MDApKyctJysoZC5nZXRNb250aCgpKzEpKyctJytkLmdldERhdGUoKTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gIGluaXQgOiBpbml0XG59O1xuIiwidmFyIG1hcmtlckNvbmZpZyA9IHJlcXVpcmUoJy4uL21hcmtlcnMvY29uZmlnJyk7XG52YXIgbWFya2VyU2VsZWN0b3IgPSByZXF1aXJlKCcuLi9tYXJrZXJzJyk7XG52YXIgY2FudmFzUG9pbnRGZWF0dXJlID0gcmVxdWlyZSgnLi4vbGVhZmxldC9jYW52YXNQb2ludEZlYXR1cmUnKTtcbnZhciBtYXJrZXJzID0gbWFya2VyQ29uZmlnLmRlZmF1bHRzO1xuXG52YXIgZ2VvSnNvbkxheWVyLCBtYXJrZXJMYXllcjtcbnZhciBtYXAsIGh1YywgZGF0YXN0b3JlLCBtYXBNb2R1bGU7XG5cblxubW9kdWxlLmV4cG9ydHMuaW5pdCA9IGZ1bmN0aW9uKGNvbmZpZykge1xuICBtYXBNb2R1bGUgPSBjb25maWcubWFwO1xuICBtYXAgPSBjb25maWcubWFwLmdldExlYWZsZXQoKTtcbiAgZGF0YXN0b3JlID0gY29uZmlnLmRhdGFzdG9yZTtcbiAgaHVjID0gY29uZmlnLmh1YztcblxuICBtYXJrZXJMYXllciA9IG5ldyBMLkNhbnZhc0dlb2pzb25MYXllcih7XG4gICAgLypvbk1vdXNlT3ZlciA6IGZ1bmN0aW9uKGZlYXR1cmVzKSB7XG4gICAgICBtYXJrZXJTZWxlY3Rvci5ob3ZlcihmZWF0dXJlcyk7XG4gICAgICB1cGRhdGVNb3VzZShtYXJrZXJMYXllci5fY29udGFpbmVyLCBtYXJrZXJMYXllci5pbnRlcnNlY3RMaXN0KTtcbiAgICB9LFxuICAgIG9uTW91c2VPdXQgOiBmdW5jdGlvbihmZWF0dXJlcykge1xuICAgICAgbWFya2VyU2VsZWN0b3Iubm9ob3ZlcihmZWF0dXJlcyk7XG4gICAgICB1cGRhdGVNb3VzZShtYXJrZXJMYXllci5fY29udGFpbmVyLCBtYXJrZXJMYXllci5pbnRlcnNlY3RMaXN0KTtcbiAgICB9LCovXG4gICAgb25DbGljayA6IG9uRmVhdHVyZXNDbGlja2VkXG4gIH0pO1xuXG4gIG1hcmtlckxheWVyLmFkZFRvKG1hcCk7XG4gIG1hcmtlclNlbGVjdG9yLmluaXQobWFya2VyTGF5ZXIpO1xufTtcblxubW9kdWxlLmV4cG9ydHMuYWRkID0gZnVuY3Rpb24ocG9pbnRzKSB7XG4gIHZhciBzaG93Tm9EZW1hbmQgPSAkKCcjc2hvd05vRGVtYW5kJykuaXMoJzpjaGVja2VkJyk7XG4gIGRhdGFzdG9yZS5jbGVhckZlYXR1cmVzKCk7XG5cbiAgaWYoICFzaG93Tm9EZW1hbmQgKSB7XG4gICAgdG1wID0gW107XG4gICAgZm9yKCB2YXIgaSA9IHBvaW50cy5sZW5ndGgtMTsgaSA+PSAwOyBpLS0gKSB7XG4gICAgICBpZiggcG9pbnRzW2ldLnByb3BlcnRpZXMuYWxsb2NhdGlvbnMgJiYgcG9pbnRzW2ldLnByb3BlcnRpZXMuYWxsb2NhdGlvbnMubGVuZ3RoID4gMCApIHtcblxuICAgICAgICB2YXIgZGVtYW5kID0gcG9pbnRzW2ldLnByb3BlcnRpZXMuYWxsb2NhdGlvbnNbMF0uZGVtYW5kO1xuICAgICAgICBpZiggZGVtYW5kICE9PSAwICkgdG1wLnB1c2gocG9pbnRzW2ldKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcG9pbnRzID0gdG1wO1xuICB9XG5cbiAgbWFya2VyTGF5ZXIuZmVhdHVyZXMgPSBbXTtcbiAgcG9pbnRzLmZvckVhY2goZnVuY3Rpb24ocG9pbnQpe1xuICAgIG1hcmtlckxheWVyLmFkZEZlYXR1cmUoY2FudmFzUG9pbnRGZWF0dXJlKHBvaW50KSk7XG4gIH0pO1xuICBtYXJrZXJMYXllci5yZW5kZXIoKTtcblxuICBjdXJyZW50UG9pbnRzID0gcG9pbnRzO1xuICBodWMucmVuZGVyKHBvaW50cyk7XG59O1xuXG5mdW5jdGlvbiB1cGRhdGVNb3VzZShjb250YWluZXIsIGZlYXR1cmVzKSB7XG4gIGlmKCBmZWF0dXJlcy5sZW5ndGggPiAwICkge1xuICAgIGNvbnRhaW5lci5zdHlsZS5jdXJzb3IgPSAncG9pbnRlcic7XG4gIH0gZWxzZSB7XG4gICAgY29udGFpbmVyLnN0eWxlLmN1cnNvciA9ICdtb3ZlJztcbiAgfVxufVxuXG5mdW5jdGlvbiBvbkZlYXR1cmVzQ2xpY2tlZChmZWF0dXJlcykge1xuICB2YXIgaHRtbCA9ICcnO1xuXG4gIG1hcmtlclNlbGVjdG9yLnNlbGVjdChmZWF0dXJlcyk7XG5cbiAgZm9yKCB2YXIgaSA9IDA7IGkgPCBmZWF0dXJlcy5sZW5ndGg7IGkrKyApIHtcbiAgICB2YXIgcCA9IGZlYXR1cmVzW2ldLnByb3BlcnRpZXM7XG5cbiAgICBodG1sICs9IG1hcE1vZHVsZS5sZWdlbmQuc3RhbXAoe1xuICAgICAgYXBwbGljYXRpb25fbnVtYmVyIDogcC5hcHBsaWNhdGlvbl9udW1iZXIsXG4gICAgICBkYXRlIDogZ2V0RGF0ZShwLmFsbG9jYXRpb25zWzBdLmRhdGUpLFxuICAgICAgYWxsb2NhdGlvbiA6IHAuYWxsb2NhdGlvbnNbMF0uYWxsb2NhdGlvbixcbiAgICAgIGRlbWFuZCA6IHAuYWxsb2NhdGlvbnNbMF0uZGVtYW5kLFxuICAgICAgcmF0aW8gOiBwLmFsbG9jYXRpb25zWzBdLnJhdGlvICE9PSBudWxsID8gKHAuYWxsb2NhdGlvbnNbMF0ucmF0aW8qMTAwKS50b0ZpeGVkKDIpIDogJzEwMCcsXG4gICAgICB3YXRlcl9yaWdodF90eXBlIDogcC5fcmVuZGVyZWRfYXMsXG4gICAgICBwcmlvcml0eV9kYXRlIDogZ2V0RGF0ZShwLnByaW9yaXR5X2RhdGUpXG4gICAgfSk7XG4gIH1cblxuICAkKCcjaW5mby1yZXN1bHQnKS5odG1sKGh0bWwpO1xuICAkKCcjaW5mbycpLmFuaW1hdGUoe1xuICAgIHNjcm9sbFRvcDogJCgnLmluZm8tYm94JykuaGVpZ2h0KClcbiAgfSwgMzAwKTtcbn1cblxuZnVuY3Rpb24gZ2V0RGF0ZShkKSB7XG4gIGlmKCBkID09PSB1bmRlZmluZWQgfHwgZCA9PT0gbnVsbCkgcmV0dXJuICdVbmtub3duJztcbiAgaWYoIHR5cGVvZiBkID09PSAnc3RyaW5nJyApIHJldHVybiBkO1xuICByZXR1cm4gZC50b0RhdGVTdHJpbmcoKTtcbn1cblxubW9kdWxlLmV4cG9ydHMuY2xlYXJMYXllciA9IGZ1bmN0aW9uKCkge1xuICAvL2lmKCBnZW9Kc29uTGF5ZXIgKSBtYXAucmVtb3ZlTGF5ZXIoZ2VvSnNvbkxheWVyKTtcbiAgbWFya2VyTGF5ZXIuZmVhdHVyZXMgPSBbXTtcbiAgbWFya2VyTGF5ZXIucmVuZGVyKCk7XG59O1xuIiwidmFyIG1hcDtcbnZhciBiYXNlTWFwcyA9IHt9O1xudmFyIG92ZXJsYXlNYXBzID0ge307XG5cbnZhciBnZW9qc29uID0gcmVxdWlyZSgnLi9nZW9qc29uJyk7XG52YXIgZ2VvanNvbkxheWVyID0ge307XG5cbnZhciBjdXJyZW50UG9pbnRzID0gbnVsbDtcbnZhciBjdXJyZW50R2VvanNvbiA9IG51bGw7XG5cbm1vZHVsZS5leHBvcnRzLmxlZ2VuZCA9IHJlcXVpcmUoJy4uL2xlZ2VuZCcpO1xubW9kdWxlLmV4cG9ydHMuZ2VvanNvbiA9IHJlcXVpcmUoJy4vZ2VvanNvbicpO1xuXG5cblxubW9kdWxlLmV4cG9ydHMuaW5pdCA9IGZ1bmN0aW9uKG9wdGlvbnMpIHtcbiAgbWFwID0gTC5tYXAoJ21hcCcse3RyYWNrUmVzaXplOnRydWV9KTtcblxuICAvLyBhZGQgYW4gT3BlblN0cmVldE1hcCB0aWxlIGxheWVyXG4gIEwudGlsZUxheWVyKCdodHRwOi8ve3N9LnRpbGUub3NtLm9yZy97en0ve3h9L3t5fS5wbmcnLCB7XG4gICAgICBhdHRyaWJ1dGlvbjogJyZjb3B5OyA8YSBocmVmPVwiaHR0cDovL29zbS5vcmcvY29weXJpZ2h0XCI+T3BlblN0cmVldE1hcDwvYT4gY29udHJpYnV0b3JzJ1xuICB9KS5hZGRUbyhtYXApO1xuXG4gIHZhciB3bXMxID0gTC50aWxlTGF5ZXIud21zKFwiaHR0cHM6Ly9tYXBzZW5naW5lLmdvb2dsZS5jb20vMTU1NDI2MDA3MzQyNzU1NDk0NDQtMTE4NTM2NjcyNzMxMzE1NTAzNDYtNC93bXMvP3ZlcnNpb249MS4zLjBcIiwge1xuICAgICAgbGF5ZXJzOiAnMTU1NDI2MDA3MzQyNzU1NDk0NDQtMDgxMTI5NzQ2OTA5OTExNjQ1ODctNCcsXG4gICAgICBmb3JtYXQ6ICdpbWFnZS9wbmcnLFxuICAgICAgdHJhbnNwYXJlbnQ6IHRydWUsXG4gICAgICBhdHRyaWJ1dGlvbjogXCJcIixcbiAgICAgIGJvdW5kcyA6IEwubGF0TG5nQm91bmRzKFxuICAgICAgICBMLmxhdExuZyg0Mi4wMDk0MzE5ODgwNDA1OCwgLTExNC4xMzA3NTk3MjEzNDA3KSxcbiAgICAgICAgTC5sYXRMbmcoMzIuNTM0MjYzNDUzNjc0OTMsIC0xMjQuNDA5NzExNzE2NzgyOTgpXG4gICAgICApXG4gIH0pLmFkZFRvKG1hcCk7XG5cbiAgLyp2YXIgd21zMiA9IEwudGlsZUxheWVyLndtcyhcImh0dHBzOi8vbWFwc2VuZ2luZS5nb29nbGUuY29tLzE1NTQyNjAwNzM0Mjc1NTQ5NDQ0LTExODUzNjY3MjczMTMxNTUwMzQ2LTQvd21zLz92ZXJzaW9uPTEuMy4wXCIsIHtcbiAgICAgIGxheWVyczogJzE1NTQyNjAwNzM0Mjc1NTQ5NDQ0LTE2MTQzMTU4Njg5NjAzMzYxMDkzLTQnLFxuICAgICAgZm9ybWF0OiAnaW1hZ2UvcG5nJyxcbiAgICAgIHRyYW5zcGFyZW50OiB0cnVlLFxuICAgICAgYXR0cmlidXRpb246IFwiXCIsXG4gICAgICBib3VuZHMgOiBMLmxhdExuZ0JvdW5kcyhcbiAgICAgICAgTC5sYXRMbmcoNDIuMDA5NDMxOTg4MDQwNTgsIC0xMTQuMTMwNzU5NzIxMzQwNyksXG4gICAgICAgIEwubGF0TG5nKDMyLjUzNDI2MzQ1MzY3NDkzLCAtMTI0LjQwOTcxMTcxNjc4Mjk4KVxuICAgICAgKVxuICB9KTsqL1xuICB2YXIgd21zMiA9IEwudGlsZUxheWVyLndtcyhcImh0dHA6Ly9hdGxhcy5jd3MudWNkYXZpcy5lZHUvYXJjZ2lzL3NlcnZpY2VzL1dhdGVyc2hlZHMvTWFwU2VydmVyL1dNU1NlcnZlclwiLCB7XG4gICAgICBsYXllcnM6ICcwJyxcbiAgICAgIGZvcm1hdDogJ2ltYWdlL3BuZycsXG4gICAgICB0cmFuc3BhcmVudDogdHJ1ZSxcbiAgICAgIGF0dHJpYnV0aW9uOiBcIlwiLFxuICAgICAgYm91bmRzIDogTC5sYXRMbmdCb3VuZHMoXG4gICAgICAgIEwubGF0TG5nKDQzLjM1MzE0NCwgLTExMy4wNTg0NDMpLFxuICAgICAgICBMLmxhdExuZygzMi4wNDQ1MjgsIC0xMjQuNzE4NjM4KVxuICAgICAgKVxuICB9KTtcblxuICBiYXNlTWFwcyA9IHt9O1xuICBvdmVybGF5TWFwcyA9IHtcbiAgICAnV2F0ZXJzaGVkcyc6IHdtczEsXG4gICAgJ0hVQyAxMic6IHdtczJcbiAgfTtcblxuICBMLmNvbnRyb2wubGF5ZXJzKGJhc2VNYXBzLCBvdmVybGF5TWFwcywge3Bvc2l0aW9uOiAnYm90dG9tbGVmdCd9KS5hZGRUbyhtYXApO1xuXG4gIG9wdGlvbnMubWFwID0gdGhpcztcbiAgZ2VvanNvbi5pbml0KG9wdGlvbnMpO1xuICB0aGlzLmxlZ2VuZC5pbml0KG9wdGlvbnMpO1xufTtcblxubW9kdWxlLmV4cG9ydHMuY2xlYXJHZW9qc29uTGF5ZXIgPSBmdW5jdGlvbigpIHtcbiAgZ2VvanNvbi5jbGVhckxheWVyKCk7XG59O1xubW9kdWxlLmV4cG9ydHMuZ2V0TGVhZmxldCA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm4gbWFwO1xufTtcbiIsInZhciBtYXJrZXJzID0ge1xuICByaXBhcmlhbiA6IHtcbiAgICBhbGxvY2F0ZWQgOiB7XG4gICAgICBmaWxsQ29sb3IgICA6IFwiIzI1MjVDOVwiLFxuICAgICAgY29sb3IgICAgICAgOiBcIiMzMzMzMzNcIixcbiAgICAgIHdlaWdodCAgICAgIDogMSxcbiAgICAgIG9wYWNpdHkgICAgIDogMSxcbiAgICAgIGZpbGxPcGFjaXR5IDogMC4zLFxuXHRcdFx0c2lkZXMgOiAzLFxuXHRcdFx0cm90YXRlIDogOTAsXG4gICAgICB3aWR0aDogMjAsXG4gICAgICBoZWlnaHQ6IDIwXG4gICAgfSxcbiAgICB1bmFsbG9jYXRlZCA6IHtcbiAgICAgIGZpbGxDb2xvciAgIDogXCIjZmZmZmZmXCIsXG4gICAgICBjb2xvciAgICAgICA6IFwiIzMzMzMzM1wiLFxuICAgICAgd2VpZ2h0ICAgICAgOiAxLFxuICAgICAgb3BhY2l0eSAgICAgOiAxLFxuICAgICAgZmlsbE9wYWNpdHkgOiAwLjMsXG5cdFx0XHRzaWRlcyA6IDMsXG5cdFx0XHRyb3RhdGUgOiA5MCxcbiAgICAgIHdpZHRoOiAyMCxcbiAgICAgIGhlaWdodDogMjBcbiAgICB9XG4gIH0sXG4gIGFwcGxpY2F0aW9uIDoge1xuICAgIGFsbG9jYXRlZCA6IHtcbiAgICAgIGZpbGxDb2xvciAgIDogXCIjMjUyNUM5XCIsXG4gICAgICBjb2xvciAgICAgICA6IFwiIzMzMzMzM1wiLFxuICAgICAgd2VpZ2h0ICAgICAgOiAxLFxuICAgICAgb3BhY2l0eSAgICAgOiAxLFxuICAgICAgZmlsbE9wYWNpdHkgOiAwLjMsXG4gICAgICBzaWRlcyAgICAgICA6IDQsXG4gICAgICByb3RhdGUgICAgICA6IDQ1LFxuICAgICAgd2lkdGg6IDIwLFxuICAgICAgaGVpZ2h0OiAyMFxuICAgIH0sXG4gICAgdW5hbGxvY2F0ZWQgOiB7XG4gICAgICBmaWxsQ29sb3IgICA6IFwiI2ZmZmZmZlwiLFxuICAgICAgY29sb3IgICAgICAgOiBcIiMzMzMzMzNcIixcbiAgICAgIHdlaWdodCAgICAgIDogMSxcbiAgICAgIG9wYWNpdHkgICAgIDogMSxcbiAgICAgIGZpbGxPcGFjaXR5IDogMC4zLFxuICAgICAgc2lkZXMgICAgICAgOiA0LFxuICAgICAgcm90YXRlICAgICAgOiA0NSxcbiAgICAgIHdpZHRoOiAyMCxcbiAgICAgIGhlaWdodDogMjBcbiAgICB9XG4gIH0sXG4gIG5vRGVtYW5kIDoge1xuICAgIG5vRmlsbCA6IHRydWUsXG4gICAgLy9zaWRlcyA6IDAsXG4gICAgY29sb3IgOiBcIiMzMzMzMzNcIixcbiAgICBzdHJpa2V0aHJvdWdoIDogdHJ1ZSxcbiAgICByYWRpdXMgOiA1LFxuICAgIGhlaWdodCA6IDEyLFxuICAgIHdpZHRoIDogMTJcbiAgfVxufTtcbm1vZHVsZS5leHBvcnRzLmRlZmF1bHRzID0gbWFya2VycztcblxubW9kdWxlLmV4cG9ydHMucGVyY2VudERlbWFuZCA9IGZ1bmN0aW9uKG9wdGlvbnMsIHBlcmNlbnQsIG5vRGVtYW5kKSB7XG4gIGlmKCBub0RlbWFuZCApIHtcbiAgICAgJC5leHRlbmQodHJ1ZSwgb3B0aW9ucywgbWFya2Vycy5ub0RlbWFuZCk7XG4gICAgIHJldHVybjtcbiAgfVxuXG4gIHZhciBvO1xuXG4gIGlmKCBnbG9iYWwuc2V0dGluZ3MucmVuZGVyRGVtYW5kID09ICdmaWxsZWQnICkge1xuXG4gICAgaWYoIHBlcmNlbnQgPD0gMCApIHtcbiAgICAgIG9wdGlvbnMuZmlsbENvbG9yID0gJyMzMzMnO1xuICAgICAgb3B0aW9ucy5maWxsT3BhY2l0eSA9IDAuMztcbiAgICB9IGVsc2Uge1xuICAgICAgbyA9IHBlcmNlbnQ7XG4gICAgICBpZiggbyA+IDEgKSBvID0gMTtcbiAgICAgIG9wdGlvbnMuZmlsbE9wYWNpdHkgPSBvO1xuICAgICAgb3B0aW9ucy5maWxsQ29sb3IgPSAnIzAwMDBmZic7XG4gICAgfVxuXG4gIH0gZWxzZSB7XG5cbiAgICBpZiggcGVyY2VudCA+PSAxICkge1xuICAgICAgb3B0aW9ucy5maWxsQ29sb3IgPSAnIzMzMyc7XG4gICAgICBvcHRpb25zLmZpbGxPcGFjaXR5ID0gMC4zO1xuICAgIH0gZWxzZSB7XG4gICAgICBvID0gMSAtIHBlcmNlbnQ7XG4gICAgICBpZiggbyA+IDEgKSBvID0gMTtcbiAgICAgIGlmKCBvIDwgMCApIG8gPSAwO1xuXG4gICAgICBvcHRpb25zLmZpbGxPcGFjaXR5ID0gbztcbiAgICAgIG9wdGlvbnMuZmlsbENvbG9yID0gJyNmZjAwMDAnO1xuICAgIH1cblxuICB9XG4gIC8vb3B0aW9ucy5maWxsQ29sb3IgPSAnIycrZ2V0Q29sb3IoYWxsb2NhdGlvbiAvIGRlbWFuZCk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cy5wZXJjZW50RGVtYW5kSHVjID0gZnVuY3Rpb24ocGVyY2VudCkge1xuICBpZiggcGVyY2VudCA9PSAtMSApIHtcbiAgICAgcmV0dXJuIHtcbiAgICAgICBmaWxsQ29sb3IgOiAnI2ZmZmZmZicsXG4gICAgICAgZmlsbE9wYWNpdHkgOiAwLjIsXG4gICAgICAgd2VpZ2h0IDogMSxcbiAgICAgICBjb2xvcjogJyMzMzMzMzMnXG4gICAgIH07XG4gIH1cblxuXG4gIGlmKCBnbG9iYWwuc2V0dGluZ3MucmVuZGVyRGVtYW5kID09ICdmaWxsZWQnICkge1xuXG4gICAgaWYoIHBlcmNlbnQgPD0gMCApIHtcblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgZmlsbENvbG9yIDogJyMzMzMzMzMnLFxuICAgICAgICBmaWxsT3BhY2l0eSA6IDAuMyxcbiAgICAgICAgd2VpZ2h0IDogMixcbiAgICAgICAgY29sb3I6ICcjMzMzMzMzJ1xuICAgICAgfTtcblxuXG4gICAgfSBlbHNlIHtcbiAgICAgIHZhciBvID0gcGVyY2VudDtcbiAgICAgIGlmKCBvID4gMC44ICkgbyA9IDAuODtcblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgZmlsbENvbG9yIDogJyMwMDAwZmYnLFxuICAgICAgICBmaWxsT3BhY2l0eSA6IG8sXG4gICAgICAgIHdlaWdodCA6IDIsXG4gICAgICAgIGNvbG9yOiAnIzMzMzMzMydcbiAgICAgIH07XG4gICAgfVxuXG4gIH0gZWxzZSB7XG5cbiAgICBpZiggcGVyY2VudCA+PSAxICkge1xuXG4gICAgICByZXR1cm4ge1xuICAgICAgICBmaWxsQ29sb3IgOiAnIzMzMzMzMycsXG4gICAgICAgIGZpbGxPcGFjaXR5IDogMC4zLFxuICAgICAgICB3ZWlnaHQgOiAyLFxuICAgICAgICBjb2xvcjogJyMzMzMzMzMnXG4gICAgICB9O1xuXG4gICAgfSBlbHNlIHtcbiAgICAgIHZhciBvID0gMSAtIHBlcmNlbnQ7XG4gICAgICBpZiggbyA+IDAuOCApIG8gPSAwLjg7XG4gICAgICBpZiggbyA8IDAgKSBvID0gMDtcblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgZmlsbENvbG9yIDogJyNmZjAwMDAnLFxuICAgICAgICBmaWxsT3BhY2l0eSA6IG8sXG4gICAgICAgIHdlaWdodCA6IDIsXG4gICAgICAgIGNvbG9yOiAnIzMzMzMzMydcbiAgICAgIH07XG5cbiAgICB9XG5cbiAgfVxuICAvL29wdGlvbnMuZmlsbENvbG9yID0gJyMnK2dldENvbG9yKGFsbG9jYXRpb24gLyBkZW1hbmQpO1xufTtcbiIsInZhciBJY29uUmVuZGVyZXIgPSByZXF1aXJlKCcuL2ljb25SZW5kZXJlcicpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKGNvbmZpZykge1xuICB0aGlzLmNvbmZpZyA9IGNvbmZpZztcbiAgdGhpcy5lbGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdjYW52YXMnKTtcblxuICB0aGlzLnJlZHJhdyA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciB3ID0gY29uZmlnLmhlaWdodCB8fCAzMjtcbiAgICB2YXIgaCA9IGNvbmZpZy53aWR0aCB8fCAzMjtcblxuICAgIHRoaXMuZWxlLmhlaWdodCA9IGg7XG4gICAgdGhpcy5lbGUud2lkdGggPSB3O1xuXG4gICAgdmFyIGN0eCA9IHRoaXMuZWxlLmdldENvbnRleHQoXCIyZFwiKTtcbiAgICBjdHguY2xlYXJSZWN0KDAsIDAsIHcsIGgpO1xuXG4gICAgSWNvblJlbmRlcmVyKGN0eCwgY29uZmlnKTtcbiAgfTtcblxuICB0aGlzLnJlZHJhdygpO1xufTtcbiIsInZhciB1dGlsID0gcmVxdWlyZSgnLi91dGlscycpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKGN0eCwgY29uZmlnLCB4eVBvaW50cykge1xuXG4gIHZhciBzaWRlcyA9IGNvbmZpZy5zaWRlcyAhPT0gbnVsbCA/IGNvbmZpZy5zaWRlcyA6IDY7XG4gIHZhciByb3RhdGUgPSBjb25maWcucm90YXRlID8gY29uZmlnLnJvdGF0ZSA6IDA7XG4gIHZhciB4LCB5O1xuICBpZiggeHlQb2ludHMgKSB7XG4gICAgeCA9IHh5UG9pbnRzLng7XG4gICAgeSA9IHh5UG9pbnRzLnk7XG4gIH0gZWxzZSB7XG4gICAgeCA9IGNvbmZpZy53aWR0aCAvIDI7XG4gICAgeSA9IGNvbmZpZy5oZWlnaHQgLyAyO1xuICB9XG5cbiAgdmFyIGEgPSAoKE1hdGguUEkgKiAyKSAvIGNvbmZpZy5zaWRlcyk7XG4gIHZhciByID0gcm90YXRlICogKE1hdGguUEkgLyAxODApO1xuXG4gIHZhciByYWRpdXMgPSAoY29uZmlnLndpZHRoIC8gMikgLSAxO1xuXG4gIHZhciBmaWxsU3R5bGUgPSB1dGlsLmhleFRvUmdiKGNvbmZpZy5maWxsQ29sb3IpO1xuICBmaWxsU3R5bGUucHVzaChjb25maWcuZmlsbE9wYWNpdHkpO1xuICBjdHguZmlsbFN0eWxlID0gJ3JnYmEoJytmaWxsU3R5bGUuam9pbignLCcpKycpJztcblxuICB2YXIgY29sb3IgPSBjb25maWcuaGlnaGxpZ2h0ID8gJ3llbGxvdycgOiBjb25maWcuY29sb3I7XG4gIGlmKCBjb25maWcuaG92ZXIgKSBjb2xvciA9ICdvcmFuZ2UnO1xuICBjdHguc3Ryb2tlU3R5bGUgPSBjb2xvcjtcblxuICAvLyB0aGluayB5b3UgbmVlZCB0byBhZGp1c3QgYnkgeCwgeVxuICBjdHguYmVnaW5QYXRoKCk7XG5cbiAgLy8gZHJhdyBjaXJjbGVcbiAgaWYgKCBzaWRlcyA8IDMgKSB7XG5cbiAgICBjdHguYXJjKHgsIHksIHJhZGl1cywgMCwgMipNYXRoLlBJKTtcblxuICB9IGVsc2Uge1xuXG4gICAgdmFyIHR4LCB0eSwgaTtcbiAgICBmb3IgKGkgPSAwOyBpIDwgY29uZmlnLnNpZGVzOyBpKyspIHtcbiAgICAgIHR4ID0geCArIChyYWRpdXMgKiBNYXRoLmNvcyhhKmktcikpO1xuICAgICAgdHkgPSB5ICsgKHJhZGl1cyAqIE1hdGguc2luKGEqaS1yKSk7XG5cbiAgICAgIGlmKCBpID09PSAwICkgY3R4Lm1vdmVUbyh0eCwgdHkpO1xuICAgICAgZWxzZSBjdHgubGluZVRvKHR4LCB0eSk7XG4gICAgfVxuXG4gICAgY3R4LmxpbmVUbyh4ICsgKHJhZGl1cyAqIE1hdGguY29zKC0xICogcikpLCB5ICsgKHJhZGl1cyAqIE1hdGguc2luKC0xICogcikpKTtcbiAgICBjdHguY2xvc2VQYXRoKCk7XG4gIH1cblxuICBpZiggIWNvbmZpZy5ub0ZpbGwgKSBjdHguZmlsbCgpO1xuICBjdHguc3Ryb2tlKCk7XG5cbiAgaWYoIGNvbmZpZy5zdHJpa2V0aHJvdWdoICkge1xuICAgIGN0eC5iZWdpblBhdGgoKTtcbiAgICBpZiggeHlQb2ludHMgKSB7XG4gICAgICB2YXIgdzIgPSBjb25maWcud2lkdGggLyAyLCBoMiA9IGNvbmZpZy5oZWlnaHQgLyAyO1xuICAgICAgY3R4Lm1vdmVUbyh4LXcyLCB5LWgyKTtcbiAgICAgIGN0eC5saW5lVG8oeCt3MiAtIDEsIHkraDIgLSAxKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY3R4Lm1vdmVUbygxLCAxKTtcbiAgICAgIGN0eC5saW5lVG8oY29uZmlnLndpZHRoIC0gMSwgY29uZmlnLmhlaWdodCAtIDEpO1xuICAgIH1cblxuICAgIGN0eC5zdHJva2UoKTtcbiAgICBjdHguY2xvc2VQYXRoKCk7XG4gIH1cbn07XG4iLCJ2YXIgZGF0YSA9IHtcbiAgc2VsZWN0ZWQgOiBudWxsLFxuICBob3ZlcmVkIDogbnVsbFxufTtcbnZhciBsYXllcjtcblxubW9kdWxlLmV4cG9ydHMuaW5pdCA9IGZ1bmN0aW9uKGwpIHtcbiAgbGF5ZXIgPSBsO1xufTtcblxubW9kdWxlLmV4cG9ydHMuaG92ZXIgPSBmdW5jdGlvbihtYXJrZXJzKSB7XG4gIHVwZGF0ZSgnaG92ZXJlZCcsICdob3ZlcicsIG1hcmtlcnMpO1xufTtcblxubW9kdWxlLmV4cG9ydHMubm9ob3ZlciA9IGZ1bmN0aW9uKG1hcmtlcnMpIHtcbiAgaWYoICFkYXRhLmhvdmVyZWQgKSByZXR1cm47XG5cbiAgZm9yKCB2YXIgaSA9IDA7IGkgPCBtYXJrZXJzLmxlbmd0aDsgaSsrICkge1xuICAgIHZhciBpbmRleCA9IGRhdGEuaG92ZXJlZC5pbmRleE9mKG1hcmtlcnNbaV0pO1xuICAgIGlmKCBpbmRleCA+IC0xICkgZGF0YS5ob3ZlcmVkW2luZGV4XS5wcm9wZXJ0aWVzLl9yZW5kZXIuaG92ZXIgPSBmYWxzZTtcbiAgfVxuXG4gIGxheWVyLnJlbmRlcigpO1xufTtcblxubW9kdWxlLmV4cG9ydHMuc2VsZWN0ID0gZnVuY3Rpb24obWFya2Vycykge1xuICB1cGRhdGUoJ3NlbGVjdGVkJywgJ2hpZ2hsaWdodCcsIG1hcmtlcnMpO1xufTtcblxuZnVuY3Rpb24gdXBkYXRlKGFycmF5LCBwcm9wZXJ0eSwgbWFya2Vycykge1xuICBpZiggZGF0YVthcnJheV0gIT09IG51bGwgKSB7XG4gICAgZGF0YVthcnJheV0uZm9yRWFjaChmdW5jdGlvbihtYXJrZXIpe1xuICAgICAgbWFya2VyLnByb3BlcnRpZXMuX3JlbmRlcltwcm9wZXJ0eV0gPSBmYWxzZTtcbiAgICB9KTtcbiAgfVxuXG4gIGlmKCBtYXJrZXJzICkge1xuICAgIGRhdGFbYXJyYXldID0gbWFya2VycztcbiAgICBtYXJrZXJzLmZvckVhY2goZnVuY3Rpb24obWFya2VyKXtcbiAgICAgIG1hcmtlci5wcm9wZXJ0aWVzLl9yZW5kZXJbcHJvcGVydHldID0gdHJ1ZTtcbiAgICB9KTtcbiAgfVxuXG4gIGlmKCBsYXllciApIHtcbiAgICBsYXllci5yZW5kZXIoKTtcbiAgfVxufVxuIiwibW9kdWxlLmV4cG9ydHMuaGV4VG9SZ2IgPSBmdW5jdGlvbihoZXgpIHtcbiAgICB2YXIgcmVzdWx0ID0gL14jPyhbYS1mXFxkXXsyfSkoW2EtZlxcZF17Mn0pKFthLWZcXGRdezJ9KSQvaS5leGVjKGhleCk7XG4gICAgcmV0dXJuIHJlc3VsdCA/IFtcbiAgICAgICAgcGFyc2VJbnQocmVzdWx0WzFdLCAxNiksXG4gICAgICAgIHBhcnNlSW50KHJlc3VsdFsyXSwgMTYpLFxuICAgICAgICBwYXJzZUludChyZXN1bHRbM10sIDE2KVxuICAgIF0gOiBbMCwwLDBdO1xufTtcblxubW9kdWxlLmV4cG9ydHMuZ2V0Q29sb3IgPSBmdW5jdGlvbihudW0pIHtcbiAgaWYoIG51bSA+IDEgKSBudW0gPSAxO1xuICBpZiggbnVtIDwgMCApIG51bSA9IDA7XG5cbiAgdmFyIHNwcmVhZCA9IE1hdGguZmxvb3IoNTEwKm51bSkgLSAyNTU7XG5cbiAgaWYoIHNwcmVhZCA8IDAgKSByZXR1cm4gXCJmZjAwXCIrdG9IZXgoMjU1K3NwcmVhZCk7XG4gIGVsc2UgaWYoIHNwcmVhZCA+IDAgKSByZXR1cm4gdG9IZXgoMjU1LXNwcmVhZCkrXCIwMGZmXCI7XG4gIGVsc2UgcmV0dXJuIFwiZmZmZjAwXCI7XG59O1xuXG5tb2R1bGUuZXhwb3J0cy50b0hleCA9IGZ1bmN0aW9uKG51bSkge1xuICBudW0gPSBudW0udG9TdHJpbmcoMTYpO1xuICBpZiggbnVtLmxlbmd0aCA9PSAxICkgbnVtID0gXCIwXCIrbnVtO1xuICByZXR1cm4gbnVtO1xufTtcbiIsIi8qKlxuICBBIEZlYXR1cmUgc2hvdWxkIGhhdmUgdGhlIGZvbGxvd2luZzpcblxuICBmZWF0dXJlID0ge1xuICAgIHZpc2libGUgOiBCb29sZWFuLFxuICAgIHNpemUgOiBOdW1iZXIsIC8vIHBvaW50cyBvbmx5LCB1c2VkIGZvciBtb3VzZSBpbnRlcmFjdGlvbnNcbiAgICBnZW9qc29uIDoge31cbiAgICByZW5kZXIgOiBmdW5jdGlvbihjb250ZXh0LCBjb29yZGluYXRlc0luWFksIG1hcCkge30gLy8gY2FsbGVkIGluIGZlYXR1cmUgc2NvcGVcbiAgfVxuXG4gIGdlb1hZIGFuZCBsZWFmbGV0IHdpbGwgYmUgYXNzaWduZWRcbioqL1xuXG5MLkNhbnZhc0dlb2pzb25MYXllciA9IEwuQ2xhc3MuZXh0ZW5kKHtcbiAgLy8gc2hvdyBsYXllciB0aW1pbmdcbiAgZGVidWcgOiBmYWxzZSxcblxuICAvLyBpbmNsdWRlIGV2ZW50c1xuICBpbmNsdWRlczogW0wuTWl4aW4uRXZlbnRzXSxcblxuICAvLyBsaXN0IG9mIGdlb2pzb24gZmVhdHVyZXMgdG8gZHJhd1xuICAvLyAgIC0gdGhlc2Ugd2lsbCBkcmF3IGluIG9yZGVyXG4gIGZlYXR1cmVzIDogW10sXG5cbiAgLy8gbGlzdCBvZiBjdXJyZW50IGZlYXR1cmVzIHVuZGVyIHRoZSBtb3VzZVxuICBpbnRlcnNlY3RMaXN0IDogW10sXG5cbiAgLy8gdXNlZCB0byBjYWxjdWxhdGUgcGl4ZWxzIG1vdmVkIGZyb20gY2VudGVyXG4gIGxhc3RDZW50ZXJMTCA6IG51bGwsXG5cbiAgLy8gZ2VvbWV0cnkgaGVscGVyc1xuICB1dGlscyA6IHJlcXVpcmUoJy4vdXRpbHMnKSxcblxuICAvLyBpbml0aWFsaXplIGxheWVyXG4gIGluaXRpYWxpemU6IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgLy8gc2V0IG9wdGlvbnNcbiAgICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcbiAgICBMLlV0aWwuc2V0T3B0aW9ucyh0aGlzLCBvcHRpb25zKTtcblxuICAgIC8vIG1vdmUgbW91c2UgZXZlbnQgaGFuZGxlcnMgdG8gbGF5ZXIgc2NvcGVcbiAgICB2YXIgbW91c2VFdmVudHMgPSBbJ29uTW91c2VPdmVyJywgJ29uTW91c2VNb3ZlJywgJ29uTW91c2VPdXQnLCAnb25DbGljayddO1xuICAgIG1vdXNlRXZlbnRzLmZvckVhY2goZnVuY3Rpb24oZSl7XG4gICAgICBpZiggIXRoaXMub3B0aW9uc1tlXSApIHJldHVybjtcbiAgICAgIHRoaXNbZV0gPSB0aGlzLm9wdGlvbnNbZV07XG4gICAgICBkZWxldGUgdGhpcy5vcHRpb25zW2VdO1xuICAgIH0uYmluZCh0aGlzKSk7XG5cbiAgICAvLyBzZXQgY2FudmFzIGFuZCBjYW52YXMgY29udGV4dCBzaG9ydGN1dHNcbiAgICB0aGlzLl9jYW52YXMgPSB0aGlzLl9jcmVhdGVDYW52YXMoKTtcbiAgICB0aGlzLl9jdHggPSB0aGlzLl9jYW52YXMuZ2V0Q29udGV4dCgnMmQnKTtcbiAgfSxcblxuICBfY3JlYXRlQ2FudmFzOiBmdW5jdGlvbigpIHtcbiAgICB2YXIgY2FudmFzID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnY2FudmFzJyk7XG4gICAgY2FudmFzLnN0eWxlLnBvc2l0aW9uID0gJ2Fic29sdXRlJztcbiAgICBjYW52YXMuc3R5bGUudG9wID0gMDtcbiAgICBjYW52YXMuc3R5bGUubGVmdCA9IDA7XG4gICAgY2FudmFzLnN0eWxlLnBvaW50ZXJFdmVudHMgPSBcIm5vbmVcIjtcbiAgICBjYW52YXMuc3R5bGUuekluZGV4ID0gdGhpcy5vcHRpb25zLnpJbmRleCB8fCAwO1xuICAgIHZhciBjbGFzc05hbWUgPSAnbGVhZmxldC10aWxlLWNvbnRhaW5lciBsZWFmbGV0LXpvb20tYW5pbWF0ZWQnO1xuICAgIGNhbnZhcy5zZXRBdHRyaWJ1dGUoJ2NsYXNzJywgY2xhc3NOYW1lKTtcbiAgICByZXR1cm4gY2FudmFzO1xuICB9LFxuXG4gIG9uQWRkOiBmdW5jdGlvbiAobWFwKSB7XG4gICAgdGhpcy5fbWFwID0gbWFwO1xuXG4gICAgLy8gYWRkIGNvbnRhaW5lciB3aXRoIHRoZSBjYW52YXMgdG8gdGhlIHRpbGUgcGFuZVxuICAgIC8vIHRoZSBjb250YWluZXIgaXMgbW92ZWQgaW4gdGhlIG9wb3NpdGUgZGlyZWN0aW9uIG9mIHRoZVxuICAgIC8vIG1hcCBwYW5lIHRvIGtlZXAgdGhlIGNhbnZhcyBhbHdheXMgaW4gKDAsIDApXG4gICAgLy92YXIgdGlsZVBhbmUgPSB0aGlzLl9tYXAuX3BhbmVzLnRpbGVQYW5lO1xuICAgIHZhciB0aWxlUGFuZSA9IHRoaXMuX21hcC5fcGFuZXMubWFya2VyUGFuZTtcbiAgICB2YXIgX2NvbnRhaW5lciA9IEwuRG9tVXRpbC5jcmVhdGUoJ2RpdicsICdsZWFmbGV0LWxheWVyJyk7XG5cbiAgICBfY29udGFpbmVyLmFwcGVuZENoaWxkKHRoaXMuX2NhbnZhcyk7XG4gICAgdGlsZVBhbmUuYXBwZW5kQ2hpbGQoX2NvbnRhaW5lcik7XG5cbiAgICB0aGlzLl9jb250YWluZXIgPSBfY29udGFpbmVyO1xuXG4gICAgLy8gaGFjazogbGlzdGVuIHRvIHByZWRyYWcgZXZlbnQgbGF1bmNoZWQgYnkgZHJhZ2dpbmcgdG9cbiAgICAvLyBzZXQgY29udGFpbmVyIGluIHBvc2l0aW9uICgwLCAwKSBpbiBzY3JlZW4gY29vcmRpbmF0ZXNcbiAgICBpZiAobWFwLmRyYWdnaW5nLmVuYWJsZWQoKSkge1xuICAgICAgbWFwLmRyYWdnaW5nLl9kcmFnZ2FibGUub24oJ3ByZWRyYWcnLCBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIGQgPSBtYXAuZHJhZ2dpbmcuX2RyYWdnYWJsZTtcbiAgICAgICAgTC5Eb21VdGlsLnNldFBvc2l0aW9uKHRoaXMuX2NhbnZhcywgeyB4OiAtZC5fbmV3UG9zLngsIHk6IC1kLl9uZXdQb3MueSB9KTtcbiAgICAgIH0sIHRoaXMpO1xuICAgIH1cblxuICAgIG1hcC5vbih7XG4gICAgICAndmlld3Jlc2V0JyA6IHRoaXMuX3Jlc2V0LFxuICAgICAgJ3Jlc2l6ZScgICAgOiB0aGlzLl9yZXNldCxcbiAgICAgICdtb3ZlJyAgICAgIDogdGhpcy5yZW5kZXIsXG4gICAgICAnem9vbXN0YXJ0JyA6IHRoaXMuX3N0YXJ0Wm9vbSxcbiAgICAgICd6b29tZW5kJyAgIDogdGhpcy5fZW5kWm9vbSxcbiAgICAgICdtb3VzZW1vdmUnIDogdGhpcy5faW50ZXJzZWN0cyxcbiAgICAgICdjbGljaycgICAgIDogdGhpcy5faW50ZXJzZWN0c1xuICAgIH0sIHRoaXMpO1xuXG4gICAgdGhpcy5fcmVzZXQoKTtcblxuICAgIGlmKCB0aGlzLnpJbmRleCAhPT0gdW5kZWZpbmVkICkge1xuICAgICAgdGhpcy5zZXRaSW5kZXgodGhpcy56SW5kZXgpO1xuICAgIH1cbiAgfSxcblxuICBzZXRaSW5kZXggOiBmdW5jdGlvbihpbmRleCkge1xuICAgIHRoaXMuekluZGV4ID0gaW5kZXg7XG4gICAgaWYoIHRoaXMuX2NvbnRhaW5lciApIHtcbiAgICAgIHRoaXMuX2NvbnRhaW5lci5zdHlsZS56SW5kZXggPSBpbmRleDtcbiAgICB9XG4gIH0sXG5cbiAgX3N0YXJ0Wm9vbTogZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5fY2FudmFzLnN0eWxlLnZpc2liaWxpdHkgPSAnaGlkZGVuJztcbiAgICB0aGlzLnpvb21pbmcgPSB0cnVlO1xuICB9LFxuXG4gIF9lbmRab29tOiBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5fY2FudmFzLnN0eWxlLnZpc2liaWxpdHkgPSAndmlzaWJsZSc7XG4gICAgdGhpcy56b29taW5nID0gZmFsc2U7XG4gICAgc2V0VGltZW91dCh0aGlzLnJlbmRlci5iaW5kKHRoaXMpLCA1MCk7XG4gIH0sXG5cbiAgZ2V0Q2FudmFzOiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5fY2FudmFzO1xuICB9LFxuXG4gIGRyYXc6IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMuX3Jlc2V0KCk7XG4gIH0sXG5cbiAgb25SZW1vdmU6IGZ1bmN0aW9uIChtYXApIHtcbiAgICB0aGlzLl9jb250YWluZXIucGFyZW50Tm9kZS5yZW1vdmVDaGlsZCh0aGlzLl9jb250YWluZXIpO1xuICAgIG1hcC5vZmYoe1xuICAgICAgJ3ZpZXdyZXNldCcgOiB0aGlzLl9yZXNldCxcbiAgICAgICdyZXNpemUnICAgIDogdGhpcy5fcmVzZXQsXG4gICAgICAnbW92ZScgICAgICA6IHRoaXMucmVuZGVyLFxuICAgICAgJ3pvb21zdGFydCcgOiB0aGlzLl9zdGFydFpvb20sXG4gICAgICAnem9vbWVuZCcgICA6IHRoaXMuX2VuZFpvb20sXG4gICAgICAnbW91c2Vtb3ZlJyA6IHRoaXMuX2ludGVyc2VjdHMsXG4gICAgICAnY2xpY2snICAgICA6IHRoaXMuX2ludGVyc2VjdHNcbiAgICB9LCB0aGlzKTtcbiAgfSxcblxuICBhZGRUbzogZnVuY3Rpb24gKG1hcCkge1xuICAgIG1hcC5hZGRMYXllcih0aGlzKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfSxcblxuICBfcmVzZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAvLyByZXNldCBhY3R1YWwgY2FudmFzIHNpemVcbiAgICB2YXIgc2l6ZSA9IHRoaXMuX21hcC5nZXRTaXplKCk7XG4gICAgdGhpcy5fY2FudmFzLndpZHRoID0gc2l6ZS54O1xuICAgIHRoaXMuX2NhbnZhcy5oZWlnaHQgPSBzaXplLnk7XG5cbiAgICB0aGlzLmNsZWFyQ2FjaGUoKTtcblxuICAgIHRoaXMucmVuZGVyKCk7XG4gIH0sXG5cbiAgLy8gY2xlYXIgZWFjaCBmZWF0dXJlcyBjYWNoZVxuICBjbGVhckNhY2hlIDogZnVuY3Rpb24oKSB7XG4gICAgLy8ga2lsbCB0aGUgZmVhdHVyZSBwb2ludCBjYWNoZVxuICAgIGZvciggdmFyIGkgPSAwOyBpIDwgdGhpcy5mZWF0dXJlcy5sZW5ndGg7IGkrKyApIHtcbiAgICAgIHRoaXMuY2xlYXJGZWF0dXJlQ2FjaGUoIHRoaXMuZmVhdHVyZXNbaV0gKTtcbiAgICB9XG4gIH0sXG5cbiAgY2xlYXJGZWF0dXJlQ2FjaGUgOiBmdW5jdGlvbihmZWF0dXJlKSB7XG4gICAgaWYoICFmZWF0dXJlLmNhY2hlICkgcmV0dXJuO1xuICAgIGZlYXR1cmUuY2FjaGUuZ2VvWFkgPSBudWxsO1xuICB9LFxuXG4gIC8vIHJlZHJhdyBhbGwgZmVhdHVyZXMuICBUaGlzIGRvZXMgbm90IGhhbmRsZSBjbGVhcmluZyB0aGUgY2FudmFzIG9yIHNldHRpbmdcbiAgLy8gdGhlIGNhbnZhcyBjb3JyZWN0IHBvc2l0aW9uLiAgVGhhdCBpcyBoYW5kbGVkIGJ5IHJlbmRlclxuICByZWRyYXc6IGZ1bmN0aW9uKGRpZmYpIHtcbiAgICAvLyBvYmplY3RzIHNob3VsZCBrZWVwIHRyYWNrIG9mIGxhc3QgYmJveCBhbmQgem9vbSBvZiBtYXBcbiAgICAvLyBpZiB0aGlzIGhhc24ndCBjaGFuZ2VkIHRoZSBsbCAtPiBjb250YWluZXIgcHQgaXMgbm90IG5lZWRlZFxuICAgIHZhciBib3VuZHMgPSB0aGlzLl9tYXAuZ2V0Qm91bmRzKCk7XG4gICAgdmFyIHpvb20gPSB0aGlzLl9tYXAuZ2V0Wm9vbSgpO1xuXG4gICAgaWYoIHRoaXMuZGVidWcgKSB0ID0gbmV3IERhdGUoKS5nZXRUaW1lKCk7XG5cbiAgICBmb3IoIHZhciBpID0gMDsgaSA8IHRoaXMuZmVhdHVyZXMubGVuZ3RoOyBpKysgKSB7XG4gICAgICB0aGlzLnJlZHJhd0ZlYXR1cmUodGhpcy5mZWF0dXJlc1tpXSwgYm91bmRzLCB6b29tLCBkaWZmKTtcbiAgICB9XG5cbiAgICBpZiggdGhpcy5kZWJ1ZyApIGNvbnNvbGUubG9nKCdSZW5kZXIgdGltZTogJysobmV3IERhdGUoKS5nZXRUaW1lKCkgLSB0KSsnbXM7IGF2ZzogJytcbiAgICAgICgobmV3IERhdGUoKS5nZXRUaW1lKCkgLSB0KSAvIHRoaXMuZmVhdHVyZXMubGVuZ3RoKSsnbXMnKTtcbiAgfSxcblxuICAvLyByZWRyYXcgYW4gaW5kaXZpZHVhbCBmZWF0dXJlXG4gIHJlZHJhd0ZlYXR1cmUgOiBmdW5jdGlvbihmZWF0dXJlLCBib3VuZHMsIHpvb20sIGRpZmYpIHtcbiAgICAvL2lmKCBmZWF0dXJlLmdlb2pzb24ucHJvcGVydGllcy5kZWJ1ZyApIGRlYnVnZ2VyO1xuXG4gICAgLy8gaWdub3JlIGFueXRoaW5nIGZsYWdnZWQgYXMgaGlkZGVuXG4gICAgLy8gd2UgZG8gbmVlZCB0byBjbGVhciB0aGUgY2FjaGUgaW4gdGhpcyBjYXNlXG4gICAgaWYoICFmZWF0dXJlLnZpc2libGUgKSB7XG4gICAgICB0aGlzLmNsZWFyRmVhdHVyZUNhY2hlKGZlYXR1cmUpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIG5vdyBsZXRzIGNoZWNrIGNhY2hlIHRvIHNlZSBpZiB3ZSBuZWVkIHRvIHJlcHJvamVjdCB0aGVcbiAgICAvLyB4eSBjb29yZGluYXRlc1xuICAgIHZhciByZXByb2plY3QgPSB0cnVlO1xuICAgIGlmKCBmZWF0dXJlLmNhY2hlICkge1xuICAgICAgaWYoIGZlYXR1cmUuY2FjaGUuem9vbSA9PSB6b29tICYmIGZlYXR1cmUuY2FjaGUuZ2VvWFkgKSB7XG4gICAgICAgIHJlcHJvamVjdCA9IGZhbHNlO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIGFjdHVhbGx5IHByb2plY3QgdG8geHkgaWYgbmVlZGVkXG4gICAgaWYoIHJlcHJvamVjdCApIHtcbiAgICAgIHRoaXMuX2NhbGNHZW9YWShmZWF0dXJlLCB6b29tKTtcbiAgICB9ICAvLyBlbmQgcmVwcm9qZWN0XG5cbiAgICAvLyBpZiB0aGlzIHdhcyBhIHNpbXBsZSBwYW4gZXZlbnQgKGEgZGlmZiB3YXMgcHJvdmlkZWQpIGFuZCB3ZSBkaWQgbm90IHJlcHJvamVjdFxuICAgIC8vIG1vdmUgdGhlIGZlYXR1cmUgYnkgZGlmZiB4L3lcbiAgICBpZiggZGlmZiAmJiAhcmVwcm9qZWN0ICkge1xuICAgICAgaWYoIGZlYXR1cmUuZ2VvanNvbi5nZW9tZXRyeS50eXBlID09ICdQb2ludCcgKSB7XG5cbiAgICAgICAgZmVhdHVyZS5jYWNoZS5nZW9YWS54ICs9IGRpZmYueDtcbiAgICAgICAgZmVhdHVyZS5jYWNoZS5nZW9YWS55ICs9IGRpZmYueTtcblxuICAgICAgfSBlbHNlIGlmKCBmZWF0dXJlLmdlb2pzb24uZ2VvbWV0cnkudHlwZSA9PSAnTGluZVN0cmluZycgKSB7XG5cbiAgICAgICAgdGhpcy51dGlscy5tb3ZlTGluZShmZWF0dXJlLmNhY2hlLmdlb1hZLCBkaWZmKTtcblxuICAgICAgfSBlbHNlIGlmICggZmVhdHVyZS5nZW9qc29uLmdlb21ldHJ5LnR5cGUgPT0gJ1BvbHlnb24nICkge1xuICAgICAgICB0aGlzLnV0aWxzLm1vdmVMaW5lKGZlYXR1cmUuY2FjaGUuZ2VvWFksIGRpZmYpO1xuICAgICAgfSBlbHNlIGlmICggZmVhdHVyZS5nZW9qc29uLmdlb21ldHJ5LnR5cGUgPT0gJ011bHRpUG9seWdvbicgKSB7XG4gICAgICAgIGZvciggdmFyIGkgPSAwOyBpIDwgZmVhdHVyZS5jYWNoZS5nZW9YWS5sZW5ndGg7IGkrKyApIHtcbiAgICAgICAgICB0aGlzLnV0aWxzLm1vdmVMaW5lKGZlYXR1cmUuY2FjaGUuZ2VvWFlbaV0sIGRpZmYpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gaWdub3JlIGFueXRoaW5nIG5vdCBpbiBib3VuZHNcbiAgICBpZiggZmVhdHVyZS5nZW9qc29uLmdlb21ldHJ5LnR5cGUgPT0gJ1BvaW50JyApIHtcbiAgICAgIGlmKCAhYm91bmRzLmNvbnRhaW5zKGZlYXR1cmUubGF0bG5nKSApIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiggZmVhdHVyZS5nZW9qc29uLmdlb21ldHJ5LnR5cGUgPT0gJ011bHRpUG9seWdvbicgKSB7XG5cbiAgICAgIC8vIGp1c3QgbWFrZSBzdXJlIGF0IGxlYXN0IG9uZSBwb2x5Z29uIGlzIHdpdGhpbiByYW5nZVxuICAgICAgdmFyIGZvdW5kID0gZmFsc2U7XG4gICAgICBmb3IoIHZhciBpID0gMDsgaSA8IGZlYXR1cmUuYm91bmRzLmxlbmd0aDsgaSsrICkge1xuICAgICAgICBpZiggYm91bmRzLmNvbnRhaW5zKGZlYXR1cmUuYm91bmRzW2ldKSB8fCBib3VuZHMuaW50ZXJzZWN0cyhmZWF0dXJlLmJvdW5kc1tpXSkgKSB7XG4gICAgICAgICAgZm91bmQgPSB0cnVlO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiggIWZvdW5kICkgcmV0dXJuO1xuXG4gICAgfSBlbHNlIHtcbiAgICAgIGlmKCAhYm91bmRzLmNvbnRhaW5zKGZlYXR1cmUuYm91bmRzKSAmJiAhYm91bmRzLmludGVyc2VjdHMoZmVhdHVyZS5ib3VuZHMpICkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gY2FsbCBmZWF0dXJlIHJlbmRlciBmdW5jdGlvbiBpbiBmZWF0dXJlIHNjb3BlOyBmZWF0dXJlIGlzIHBhc3NlZCBhcyB3ZWxsXG4gICAgZmVhdHVyZS5yZW5kZXIuY2FsbChmZWF0dXJlLCB0aGlzLl9jdHgsIGZlYXR1cmUuY2FjaGUuZ2VvWFksIHRoaXMuX21hcCwgZmVhdHVyZSk7XG4gIH0sXG5cbiAgX2NhbGNHZW9YWSA6IGZ1bmN0aW9uKGZlYXR1cmUsIHpvb20pIHtcbiAgICAvLyBtYWtlIHN1cmUgd2UgaGF2ZSBhIGNhY2hlIG5hbWVzcGFjZSBhbmQgc2V0IHRoZSB6b29tIGxldmVsXG4gICAgaWYoICFmZWF0dXJlLmNhY2hlICkgZmVhdHVyZS5jYWNoZSA9IHt9O1xuICAgIGZlYXR1cmUuY2FjaGUuem9vbSA9IHpvb207XG5cbiAgICBpZiggZmVhdHVyZS5nZW9qc29uLmdlb21ldHJ5LnR5cGUgPT0gJ1BvaW50JyApIHtcblxuICAgICAgZmVhdHVyZS5jYWNoZS5nZW9YWSA9IHRoaXMuX21hcC5sYXRMbmdUb0NvbnRhaW5lclBvaW50KFtcbiAgICAgICAgICBmZWF0dXJlLmdlb2pzb24uZ2VvbWV0cnkuY29vcmRpbmF0ZXNbMV0sXG4gICAgICAgICAgZmVhdHVyZS5nZW9qc29uLmdlb21ldHJ5LmNvb3JkaW5hdGVzWzBdXG4gICAgICBdKTtcblxuICAgICAgaWYoIGZlYXR1cmUuc2l6ZSApIHtcbiAgICAgICAgZmVhdHVyZS5jYWNoZS5nZW9YWVswXSA9IGZlYXR1cmUuY2FjaGUuZ2VvWFlbMF0gLSBmZWF0dXJlLnNpemUgLyAyO1xuICAgICAgICBmZWF0dXJlLmNhY2hlLmdlb1hZWzFdID0gZmVhdHVyZS5jYWNoZS5nZW9YWVsxXSAtIGZlYXR1cmUuc2l6ZSAvIDI7XG4gICAgICB9XG5cbiAgICB9IGVsc2UgaWYoIGZlYXR1cmUuZ2VvanNvbi5nZW9tZXRyeS50eXBlID09ICdMaW5lU3RyaW5nJyApIHtcbiAgICAgIGZlYXR1cmUuY2FjaGUuZ2VvWFkgPSB0aGlzLnV0aWxzLnByb2plY3RMaW5lKGZlYXR1cmUuZ2VvanNvbi5nZW9tZXRyeS5jb29yZGluYXRlcywgdGhpcy5fbWFwKTtcblxuICAgIH0gZWxzZSBpZiAoIGZlYXR1cmUuZ2VvanNvbi5nZW9tZXRyeS50eXBlID09ICdQb2x5Z29uJyApIHtcbiAgICAgIGZlYXR1cmUuY2FjaGUuZ2VvWFkgPSB0aGlzLnV0aWxzLnByb2plY3RMaW5lKGZlYXR1cmUuZ2VvanNvbi5nZW9tZXRyeS5jb29yZGluYXRlc1swXSwgdGhpcy5fbWFwKTtcbiAgICB9IGVsc2UgaWYgKCBmZWF0dXJlLmdlb2pzb24uZ2VvbWV0cnkudHlwZSA9PSAnTXVsdGlQb2x5Z29uJyApIHtcbiAgICAgIGZlYXR1cmUuY2FjaGUuZ2VvWFkgPSBbXTtcbiAgICAgIGZvciggdmFyIGkgPSAwOyBpIDwgZmVhdHVyZS5nZW9qc29uLmdlb21ldHJ5LmNvb3JkaW5hdGVzLmxlbmd0aDsgaSsrICkge1xuICAgICAgICBmZWF0dXJlLmNhY2hlLmdlb1hZLnB1c2godGhpcy51dGlscy5wcm9qZWN0TGluZShmZWF0dXJlLmdlb2pzb24uZ2VvbWV0cnkuY29vcmRpbmF0ZXNbaV1bMF0sIHRoaXMuX21hcCkpO1xuICAgICAgfVxuICAgIH1cblxuICB9LFxuXG4gIGFkZEZlYXR1cmVzIDogZnVuY3Rpb24oZmVhdHVyZXMpIHtcbiAgICBmb3IoIHZhciBpID0gMDsgaSA8IHRoaXMuZmVhdHVyZXMubGVuZ3RoOyBpKysgKSB7XG4gICAgICB0aGlzLmFkZEZlYXR1cmUodGhpcy5mZWF0dXJlc1tpXSk7XG4gICAgfVxuICB9LFxuXG4gIGFkZEZlYXR1cmUgOiBmdW5jdGlvbihmZWF0dXJlLCBib3R0b20pIHtcbiAgICBpZiggIWZlYXR1cmUuZ2VvanNvbiApIHJldHVybjtcbiAgICBpZiggIWZlYXR1cmUuZ2VvanNvbi5nZW9tZXRyeSApIHJldHVybjtcblxuICAgIGlmKCB0eXBlb2YgZmVhdHVyZS52aXNpYmxlID09PSAndW5kZWZpbmVkJyApIGZlYXR1cmUudmlzaWJsZSA9IHRydWU7XG4gICAgZmVhdHVyZS5jYWNoZSA9IG51bGw7XG5cbiAgICBpZiggZmVhdHVyZS5nZW9qc29uLmdlb21ldHJ5LnR5cGUgPT0gJ0xpbmVTdHJpbmcnICkge1xuICAgICAgZmVhdHVyZS5ib3VuZHMgPSB0aGlzLnV0aWxzLmNhbGNCb3VuZHMoZmVhdHVyZS5nZW9qc29uLmdlb21ldHJ5LmNvb3JkaW5hdGVzKTtcblxuICAgIH0gZWxzZSBpZiAoIGZlYXR1cmUuZ2VvanNvbi5nZW9tZXRyeS50eXBlID09ICdQb2x5Z29uJyApIHtcbiAgICAgIC8vIFRPRE86IHdlIG9ubHkgc3VwcG9ydCBvdXRlciByaW5ncyBvdXQgdGhlIG1vbWVudCwgbm8gaW5uZXIgcmluZ3MuICBUaHVzIGNvb3JkaW5hdGVzWzBdXG4gICAgICBmZWF0dXJlLmJvdW5kcyA9IHRoaXMudXRpbHMuY2FsY0JvdW5kcyhmZWF0dXJlLmdlb2pzb24uZ2VvbWV0cnkuY29vcmRpbmF0ZXNbMF0pO1xuXG4gICAgfSBlbHNlIGlmICggZmVhdHVyZS5nZW9qc29uLmdlb21ldHJ5LnR5cGUgPT0gJ1BvaW50JyApIHtcbiAgICAgIGZlYXR1cmUubGF0bG5nID0gTC5sYXRMbmcoZmVhdHVyZS5nZW9qc29uLmdlb21ldHJ5LmNvb3JkaW5hdGVzWzFdLCBmZWF0dXJlLmdlb2pzb24uZ2VvbWV0cnkuY29vcmRpbmF0ZXNbMF0pO1xuICAgIH0gZWxzZSBpZiAoIGZlYXR1cmUuZ2VvanNvbi5nZW9tZXRyeS50eXBlID09ICdNdWx0aVBvbHlnb24nICkge1xuICAgICAgZmVhdHVyZS5ib3VuZHMgPSBbXTtcbiAgICAgIGZvciggdmFyIGkgPSAwOyBpIDwgZmVhdHVyZS5nZW9qc29uLmdlb21ldHJ5LmNvb3JkaW5hdGVzLmxlbmd0aDsgaSsrICApIHtcbiAgICAgICAgZmVhdHVyZS5ib3VuZHMucHVzaCh0aGlzLnV0aWxzLmNhbGNCb3VuZHMoZmVhdHVyZS5nZW9qc29uLmdlb21ldHJ5LmNvb3JkaW5hdGVzW2ldWzBdKSk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnNvbGUubG9nKCdHZW9KU09OIGZlYXR1cmUgdHlwZSBcIicrZmVhdHVyZS5nZW9qc29uLmdlb21ldHJ5LnR5cGUrJ1wiIG5vdCBzdXBwb3J0ZWQuJyk7XG4gICAgICBjb25zb2xlLmxvZyhmZWF0dXJlLmdlb2pzb24pO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmKCBib3R0b20gKSB7IC8vIGJvdHRvbSBvciBpbmRleFxuICAgICAgaWYoIHR5cGVvZiBib3R0b20gPT09ICdudW1iZXInKSB0aGlzLmZlYXR1cmVzLnNwbGljZShib3R0b20sIDAsIGZlYXR1cmUpO1xuICAgICAgZWxzZSB0aGlzLmZlYXR1cmVzLnVuc2hpZnQoZmVhdHVyZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuZmVhdHVyZXMucHVzaChmZWF0dXJlKTtcbiAgICB9XG4gIH0sXG5cbiAgYWRkRmVhdHVyZUJvdHRvbSA6IGZ1bmN0aW9uKGZlYXR1cmUpIHtcbiAgICB0aGlzLmFkZEZlYXR1cmUoZmVhdHVyZSwgdHJ1ZSk7XG4gIH0sXG5cbiAgLy8gcmV0dXJucyB0cnVlIGlmIHJlLXJlbmRlciByZXF1aXJlZC4gIGllIHRoZSBmZWF0dXJlIHdhcyB2aXNpYmxlO1xuICByZW1vdmVGZWF0dXJlIDogZnVuY3Rpb24oZmVhdHVyZSkge1xuICAgIHZhciBpbmRleCA9IHRoaXMuZmVhdHVyZXMuaW5kZXhPZihmZWF0dXJlKTtcbiAgICBpZiggaW5kZXggPT0gLTEgKSByZXR1cm47XG5cbiAgICB0aGlzLnNwbGljZShpbmRleCwgMSk7XG5cbiAgICBpZiggdGhpcy5mZWF0dXJlLnZpc2libGUgKSByZXR1cm4gdHJ1ZTtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH0sXG5cbiAgLy8gZ2V0IGxheWVyIGZlYXR1cmUgdmlhIGdlb2pzb24gb2JqZWN0XG4gIGdldEZlYXR1cmVGb3JHZW9qc29uIDogZnVuY3Rpb24oZ2VvanNvbikge1xuICAgIGZvciggdmFyIGkgPSAwOyBpIDwgdGhpcy5mZWF0dXJlcy5sZW5ndGg7IGkrKyApIHtcbiAgICAgIGlmKCB0aGlzLmZlYXR1cmVzW2ldLmdlb2pzb24gPT0gZ2VvanNvbiApIHJldHVybiB0aGlzLmZlYXR1cmVzW2ldO1xuICAgIH1cblxuICAgIHJldHVybiBudWxsO1xuICB9LFxuXG4gIHJlbmRlcjogZnVuY3Rpb24oZSkge1xuICAgIHZhciB0LCBkaWZmXG4gICAgaWYoIHRoaXMuZGVidWcgKSB0ID0gbmV3IERhdGUoKS5nZXRUaW1lKCk7XG5cbiAgICB2YXIgZGlmZiA9IG51bGw7XG4gICAgaWYoIGUgJiYgZS50eXBlID09ICdtb3ZlJyApIHtcbiAgICAgIHZhciBjZW50ZXIgPSB0aGlzLl9tYXAuZ2V0Q2VudGVyKCk7XG5cbiAgICAgIHZhciBwdCA9IHRoaXMuX21hcC5sYXRMbmdUb0NvbnRhaW5lclBvaW50KGNlbnRlcik7XG4gICAgICBpZiggdGhpcy5sYXN0Q2VudGVyTEwgKSB7XG4gICAgICAgIHZhciBsYXN0WHkgPSB0aGlzLl9tYXAubGF0TG5nVG9Db250YWluZXJQb2ludCh0aGlzLmxhc3RDZW50ZXJMTCk7XG4gICAgICAgIGRpZmYgPSB7XG4gICAgICAgICAgeCA6IGxhc3RYeS54IC0gcHQueCxcbiAgICAgICAgICB5IDogbGFzdFh5LnkgLSBwdC55XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgdGhpcy5sYXN0Q2VudGVyTEwgPSBjZW50ZXI7XG4gICAgfVxuXG4gICAgdmFyIHRvcExlZnQgPSB0aGlzLl9tYXAuY29udGFpbmVyUG9pbnRUb0xheWVyUG9pbnQoWzAsIDBdKTtcbiAgICBMLkRvbVV0aWwuc2V0UG9zaXRpb24odGhpcy5fY2FudmFzLCB0b3BMZWZ0KTtcblxuICAgIHZhciBjYW52YXMgPSB0aGlzLmdldENhbnZhcygpO1xuICAgIHZhciBjdHggPSBjYW52YXMuZ2V0Q29udGV4dCgnMmQnKTtcblxuICAgIC8vIGNsZWFyIGNhbnZhc1xuICAgIGN0eC5jbGVhclJlY3QoMCwgMCwgY2FudmFzLndpZHRoLCBjYW52YXMuaGVpZ2h0KTtcblxuICAgIGlmKCAhdGhpcy56b29taW5nICkgdGhpcy5yZWRyYXcoZGlmZik7XG5cbiAgICBpZiggdGhpcy5kZWJ1ZyApIHtcbiAgICAgIGRpZmYgPSBuZXcgRGF0ZSgpLmdldFRpbWUoKSAtIHQ7XG5cbiAgICAgIHZhciBjID0gMDtcbiAgICAgIGZvciggdmFyIGkgPSAwOyBpIDwgdGhpcy5mZWF0dXJlcy5sZW5ndGg7IGkrKyApIHtcbiAgICAgICAgaWYoICF0aGlzLmZlYXR1cmVzW2ldLmNhY2hlLmdlb1hZICkgY29udGludWU7XG4gICAgICAgIGlmKCBBcnJheS5pc0FycmF5KHRoaXMuZmVhdHVyZXNbaV0uY2FjaGUuZ2VvWFkpICkgYyArPSB0aGlzLmZlYXR1cmVzW2ldLmNhY2hlLmdlb1hZLmxlbmd0aDtcbiAgICAgIH1cblxuICAgICAgY29uc29sZS5sb2coJ1JlbmRlcmVkICcrYysnIHB0cyBpbiAnK2RpZmYrJ21zJyk7XG4gICAgfVxuICB9LFxuXG4gIC8qXG4gICAgcmV0dXJuIGxpc3Qgb2YgYWxsIGludGVyc2VjdGluZyBnZW9tZXRyeSByZWdyYWRsZXNzIGlzIGN1cnJlbnRseSB2aXNpYmxlXG5cbiAgICBweFJhZGl1cyAtIGlzIGZvciBsaW5lcyBhbmQgcG9pbnRzIG9ubHkuICBCYXNpY2FsbHkgaG93IGZhciBvZmYgdGhlIGxpbmUgb3JcbiAgICBvciBwb2ludCBhIGxhdGxuZyBjYW4gYmUgYW5kIHN0aWxsIGJlIGNvbnNpZGVyZWQgaW50ZXJzZWN0aW5nLiAgVGhpcyBpc1xuICAgIGdpdmVuIGluIHB4IGFzIGl0IGlzIGNvbXBlbnNhdGluZyBmb3IgdXNlciBpbnRlbnQgd2l0aCBtb3VzZSBjbGljayBvciB0b3VjaC5cbiAgICBUaGUgcG9pbnQgbXVzdCBsYXkgaW5zaWRlIHRvIHBvbHlnb24gZm9yIGEgbWF0Y2guXG4gICovXG4gIGdldEFsbEludGVyc2VjdGluZ0dlb21ldHJ5IDogZnVuY3Rpb24obGF0bG5nLCBweFJhZGl1cykge1xuICAgIHZhciBtcHAgPSB0aGlzLnV0aWxzLm1ldGVyc1BlclB4KGxhdGxuZywgdGhpcy5fbWFwKTtcbiAgICB2YXIgciA9IG1wcCAqIChweFJhZGl1cyB8fCA1KTsgLy8gNSBweCByYWRpdXMgYnVmZmVyO1xuXG4gICAgdmFyIGNlbnRlciA9IHtcbiAgICAgIHR5cGUgOiAnUG9pbnQnLFxuICAgICAgY29vcmRpbmF0ZXMgOiBbbGF0bG5nLmxuZywgbGF0bG5nLmxhdF1cbiAgICB9O1xuICAgIHZhciB6b29tID0gdGhpcy5fbWFwLmdldFpvb20oKTtcbiAgICB2YXIgY29udGFpbmVyUG9pbnQgPSB0aGlzLl9tYXAubGF0TG5nVG9Db250YWluZXJQb2ludChsYXRsbmcpO1xuXG4gICAgdmFyIGY7XG4gICAgdmFyIGludGVyc2VjdHMgPSBbXTtcblxuICAgIGZvciggdmFyIGkgPSAwOyBpIDwgdGhpcy5mZWF0dXJlcy5sZW5ndGg7IGkrKyApIHtcbiAgICAgIGYgPSB0aGlzLmZlYXR1cmVzW2ldO1xuXG4gICAgICBpZiggIWYuZ2VvanNvbi5nZW9tZXRyeSApIGNvbnRpbnVlO1xuXG4gICAgICAvLyBjaGVjayB0aGUgYm91bmRpbmcgYm94IGZvciBpbnRlcnNlY3Rpb24gZmlyc3RcbiAgICAgIGlmKCAhdGhpcy5faXNJbkJvdW5kcyhmZWF0dXJlLCBsYXRsbmcpICkgY29udGludWU7XG5cbiAgICAgIC8vIHNlZSBpZiB3ZSBuZWVkIHRvIHJlY2FsYyB0aGUgeCx5IHNjcmVlbiBjb29yZGluYXRlIGNhY2hlXG4gICAgICBpZiggIWYuY2FjaGUgKSB0aGlzLl9jYWxjR2VvWFkoZiwgem9vbSk7XG4gICAgICBlbHNlIGlmKCAhZi5jYWNoZS5nZW9YWSApIHRoaXMuX2NhbGNHZW9YWShmLCB6b29tKTtcblxuICAgICAgaWYoIHRoaXMudXRpbHMuZ2VvbWV0cnlXaXRoaW5SYWRpdXMoZi5nZW9qc29uLmdlb21ldHJ5LCBmLmNhY2hlLmdlb1hZLCBjZW50ZXIsIGNvbnRhaW5lclBvaW50LCByKSApIHtcbiAgICAgICAgaW50ZXJzZWN0cy5wdXNoKGYpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBpbnRlcnNlY3RzO1xuICB9LFxuXG4gIC8vIHJldHVybnMgdHJ1ZSBpZiBpbiBib3VuZHMgb3IgdW5rbm93blxuICBfaXNJbkJvdW5kcyA6IGZ1bmN0aW9uKGZlYXR1cmUsIGxhdGxuZykge1xuICAgIGlmKCBmZWF0dXJlLmJvdW5kcyApIHtcbiAgICAgIGlmKCBBcnJheS5pc0FycmF5KGZlYXR1cmUuYm91bmRzKSApIHtcblxuICAgICAgICBmb3IoIHZhciBpID0gMDsgaSA8IGZlYXR1cmUuYm91bmRzLmxlbmd0aDsgaSsrICkge1xuICAgICAgICAgIGlmKCBmZWF0dXJlLmJvdW5kc1tpXS5jb250YWlucyhsYXRsbmcpICkgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cblxuICAgICAgfSBlbHNlIGlmICggZmVhdHVyZS5ib3VuZHMuY29udGFpbnMobGF0bG5nKSApIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgcmV0dXJuIHRydWU7XG4gIH0sXG5cbiAgLy8gZ2V0IHRoZSBtZXRlcnMgcGVyIHB4IGFuZCBhIGNlcnRhaW4gcG9pbnQ7XG4gIGdldE1ldGVyc1BlclB4IDogZnVuY3Rpb24obGF0bG5nKSB7XG4gICAgcmV0dXJuIHRoaXMudXRpbHMubWV0ZXJzUGVyUHgobGF0bG5nLCB0aGlzLl9tYXApO1xuICB9LFxuXG4gIF9pbnRlcnNlY3RzIDogZnVuY3Rpb24oZSkge1xuICAgIHZhciB0ID0gbmV3IERhdGUoKS5nZXRUaW1lKCk7XG4gICAgdmFyIG1wcCA9IHRoaXMuZ2V0TWV0ZXJzUGVyUHgoZS5sYXRsbmcpO1xuICAgIHZhciByID0gbXBwICogNTsgLy8gNSBweCByYWRpdXMgYnVmZmVyO1xuXG4gICAgdmFyIGNlbnRlciA9IHtcbiAgICAgIHR5cGUgOiAnUG9pbnQnLFxuICAgICAgY29vcmRpbmF0ZXMgOiBbZS5sYXRsbmcubG5nLCBlLmxhdGxuZy5sYXRdXG4gICAgfTtcblxuICAgIHZhciBmO1xuICAgIHZhciBpbnRlcnNlY3RzID0gW107XG5cbiAgICBmb3IoIHZhciBpID0gMDsgaSA8IHRoaXMuZmVhdHVyZXMubGVuZ3RoOyBpKysgKSB7XG4gICAgICBmID0gdGhpcy5mZWF0dXJlc1tpXTtcblxuICAgICAgaWYoICFmLnZpc2libGUgKSBjb250aW51ZTtcbiAgICAgIGlmKCAhZi5nZW9qc29uLmdlb21ldHJ5ICkgY29udGludWU7XG4gICAgICBpZiggIWYuY2FjaGUgKSBjb250aW51ZTtcbiAgICAgIGlmKCAhZi5jYWNoZS5nZW9YWSApIGNvbnRpbnVlO1xuICAgICAgaWYoICF0aGlzLl9pc0luQm91bmRzKGYsIGUubGF0bG5nKSApIGNvbnRpbnVlO1xuXG4gICAgICBpZiggdGhpcy51dGlscy5nZW9tZXRyeVdpdGhpblJhZGl1cyhmLmdlb2pzb24uZ2VvbWV0cnksIGYuY2FjaGUuZ2VvWFksIGNlbnRlciwgZS5jb250YWluZXJQb2ludCwgZi5zaXplID8gKGYuc2l6ZSAqIG1wcCkgOiByKSApIHtcbiAgICAgICAgaW50ZXJzZWN0cy5wdXNoKGYuZ2VvanNvbik7XG4gICAgICB9XG5cbiAgICB9XG5cbiAgICBpZiggZS50eXBlID09ICdjbGljaycgJiYgdGhpcy5vbkNsaWNrICkge1xuICAgICAgdGhpcy5vbkNsaWNrKGludGVyc2VjdHMpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHZhciBtb3VzZW92ZXIgPSBbXSwgbW91c2VvdXQgPSBbXSwgbW91c2Vtb3ZlID0gW107XG5cbiAgICB2YXIgY2hhbmdlZCA9IGZhbHNlO1xuICAgIGZvciggdmFyIGkgPSAwOyBpIDwgaW50ZXJzZWN0cy5sZW5ndGg7IGkrKyApIHtcbiAgICAgIGlmKCB0aGlzLmludGVyc2VjdExpc3QuaW5kZXhPZihpbnRlcnNlY3RzW2ldKSA+IC0xICkge1xuICAgICAgICBtb3VzZW1vdmUucHVzaChpbnRlcnNlY3RzW2ldKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNoYW5nZWQgPSB0cnVlO1xuICAgICAgICBtb3VzZW92ZXIucHVzaChpbnRlcnNlY3RzW2ldKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmb3IoIHZhciBpID0gMDsgaSA8IHRoaXMuaW50ZXJzZWN0TGlzdC5sZW5ndGg7IGkrKyApIHtcbiAgICAgIGlmKCBpbnRlcnNlY3RzLmluZGV4T2YodGhpcy5pbnRlcnNlY3RMaXN0W2ldKSA9PSAtMSApIHtcbiAgICAgICAgY2hhbmdlZCA9IHRydWU7XG4gICAgICAgIG1vdXNlb3V0LnB1c2godGhpcy5pbnRlcnNlY3RMaXN0W2ldKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICB0aGlzLmludGVyc2VjdExpc3QgPSBpbnRlcnNlY3RzO1xuXG4gICAgaWYoIHRoaXMub25Nb3VzZU92ZXIgJiYgbW91c2VvdmVyLmxlbmd0aCA+IDAgKSB0aGlzLm9uTW91c2VPdmVyLmNhbGwodGhpcywgbW91c2VvdmVyLCBlKTtcbiAgICBpZiggdGhpcy5vbk1vdXNlTW92ZSApIHRoaXMub25Nb3VzZU1vdmUuY2FsbCh0aGlzLCBtb3VzZW1vdmUsIGUpOyAvLyBhbHdheXMgZmlyZVxuICAgIGlmKCB0aGlzLm9uTW91c2VPdXQgJiYgbW91c2VvdXQubGVuZ3RoID4gMCApIHRoaXMub25Nb3VzZU91dC5jYWxsKHRoaXMsIG1vdXNlb3V0LCBlKTtcblxuICAgIGlmKCB0aGlzLmRlYnVnICkgY29uc29sZS5sb2coJ2ludGVyc2VjdHMgdGltZTogJysobmV3IERhdGUoKS5nZXRUaW1lKCkgLSB0KSsnbXMnKTtcblxuICAgIGlmKCBjaGFuZ2VkICkgdGhpcy5yZW5kZXIoKTtcbiAgfVxufSk7XG4iLCJtb2R1bGUuZXhwb3J0cyA9IHtcbiAgbW92ZUxpbmUgOiBmdW5jdGlvbihjb29yZHMsIGRpZmYpIHtcbiAgICB2YXIgaTsgbGVuID0gY29vcmRzLmxlbmd0aDtcbiAgICBmb3IoIGkgPSAwOyBpIDwgbGVuOyBpKysgKSB7XG4gICAgICBjb29yZHNbaV0ueCArPSBkaWZmLng7XG4gICAgICBjb29yZHNbaV0ueSArPSBkaWZmLnk7XG4gICAgfVxuICB9LFxuXG4gIHByb2plY3RMaW5lIDogZnVuY3Rpb24oY29vcmRzLCBtYXApIHtcbiAgICB2YXIgeHlMaW5lID0gW107XG5cbiAgICBmb3IoIHZhciBpID0gMDsgaSA8IGNvb3Jkcy5sZW5ndGg7IGkrKyApIHtcbiAgICAgIHh5TGluZS5wdXNoKG1hcC5sYXRMbmdUb0NvbnRhaW5lclBvaW50KFtcbiAgICAgICAgICBjb29yZHNbaV1bMV0sIGNvb3Jkc1tpXVswXVxuICAgICAgXSkpO1xuICAgIH1cblxuICAgIHJldHVybiB4eUxpbmU7XG4gIH0sXG5cbiAgY2FsY0JvdW5kcyA6IGZ1bmN0aW9uKGNvb3Jkcykge1xuICAgIHZhciB4bWluID0gY29vcmRzWzBdWzFdO1xuICAgIHZhciB4bWF4ID0gY29vcmRzWzBdWzFdO1xuICAgIHZhciB5bWluID0gY29vcmRzWzBdWzBdO1xuICAgIHZhciB5bWF4ID0gY29vcmRzWzBdWzBdO1xuXG4gICAgZm9yKCB2YXIgaSA9IDE7IGkgPCBjb29yZHMubGVuZ3RoOyBpKysgKSB7XG4gICAgICBpZiggeG1pbiA+IGNvb3Jkc1tpXVsxXSApIHhtaW4gPSBjb29yZHNbaV1bMV07XG4gICAgICBpZiggeG1heCA8IGNvb3Jkc1tpXVsxXSApIHhtYXggPSBjb29yZHNbaV1bMV07XG5cbiAgICAgIGlmKCB5bWluID4gY29vcmRzW2ldWzBdICkgeW1pbiA9IGNvb3Jkc1tpXVswXTtcbiAgICAgIGlmKCB5bWF4IDwgY29vcmRzW2ldWzBdICkgeW1heCA9IGNvb3Jkc1tpXVswXTtcbiAgICB9XG5cbiAgICB2YXIgc291dGhXZXN0ID0gTC5sYXRMbmcoeG1pbi0uMDEsIHltaW4tLjAxKTtcbiAgICB2YXIgbm9ydGhFYXN0ID0gTC5sYXRMbmcoeG1heCsuMDEsIHltYXgrLjAxKTtcblxuICAgIHJldHVybiBMLmxhdExuZ0JvdW5kcyhzb3V0aFdlc3QsIG5vcnRoRWFzdCk7XG4gIH0sXG5cbiAgZ2VvbWV0cnlXaXRoaW5SYWRpdXMgOiBmdW5jdGlvbihnZW9tZXRyeSwgeHlQb2ludHMsIGNlbnRlciwgeHlQb2ludCwgcmFkaXVzKSB7XG4gICAgaWYgKGdlb21ldHJ5LnR5cGUgPT0gJ1BvaW50Jykge1xuICAgICAgcmV0dXJuIHRoaXMucG9pbnREaXN0YW5jZShnZW9tZXRyeSwgY2VudGVyKSA8PSByYWRpdXM7XG4gICAgfSBlbHNlIGlmIChnZW9tZXRyeS50eXBlID09ICdMaW5lU3RyaW5nJyApIHtcblxuICAgICAgZm9yKCB2YXIgaSA9IDE7IGkgPCB4eVBvaW50cy5sZW5ndGg7IGkrKyApIHtcbiAgICAgICAgaWYoIHRoaXMubGluZUludGVyc2VjdHNDaXJjbGUoeHlQb2ludHNbaS0xXSwgeHlQb2ludHNbaV0sIHh5UG9pbnQsIDMpICkge1xuICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9IGVsc2UgaWYgKGdlb21ldHJ5LnR5cGUgPT0gJ1BvbHlnb24nIHx8IGdlb21ldHJ5LnR5cGUgPT0gJ011bHRpUG9seWdvbicpIHtcbiAgICAgIHJldHVybiB0aGlzLnBvaW50SW5Qb2x5Z29uKGNlbnRlciwgZ2VvbWV0cnkpO1xuICAgIH1cbiAgfSxcblxuICAvLyBodHRwOi8vbWF0aC5zdGFja2V4Y2hhbmdlLmNvbS9xdWVzdGlvbnMvMjc1NTI5L2NoZWNrLWlmLWxpbmUtaW50ZXJzZWN0cy13aXRoLWNpcmNsZXMtcGVyaW1ldGVyXG4gIC8vIGh0dHBzOi8vZW4ud2lraXBlZGlhLm9yZy93aWtpL0Rpc3RhbmNlX2Zyb21fYV9wb2ludF90b19hX2xpbmVcbiAgLy8gW2xuZyB4LCBsYXQsIHldXG4gIGxpbmVJbnRlcnNlY3RzQ2lyY2xlIDogZnVuY3Rpb24obGluZVAxLCBsaW5lUDIsIHBvaW50LCByYWRpdXMpIHtcbiAgICB2YXIgZGlzdGFuY2UgPVxuICAgICAgTWF0aC5hYnMoXG4gICAgICAgICgobGluZVAyLnkgLSBsaW5lUDEueSkqcG9pbnQueCkgLSAoKGxpbmVQMi54IC0gbGluZVAxLngpKnBvaW50LnkpICsgKGxpbmVQMi54KmxpbmVQMS55KSAtIChsaW5lUDIueSpsaW5lUDEueClcbiAgICAgICkgL1xuICAgICAgTWF0aC5zcXJ0KFxuICAgICAgICBNYXRoLnBvdyhsaW5lUDIueSAtIGxpbmVQMS55LCAyKSArIE1hdGgucG93KGxpbmVQMi54IC0gbGluZVAxLngsIDIpXG4gICAgICApO1xuICAgIHJldHVybiBkaXN0YW5jZSA8PSByYWRpdXM7XG4gIH0sXG5cbiAgLy8gaHR0cDovL3dpa2kub3BlbnN0cmVldG1hcC5vcmcvd2lraS9ab29tX2xldmVsc1xuICAvLyBodHRwOi8vc3RhY2tvdmVyZmxvdy5jb20vcXVlc3Rpb25zLzI3NTQ1MDk4L2xlYWZsZXQtY2FsY3VsYXRpbmctbWV0ZXJzLXBlci1waXhlbC1hdC16b29tLWxldmVsXG4gIG1ldGVyc1BlclB4IDogZnVuY3Rpb24obGwsIG1hcCkge1xuICAgIHZhciBwb2ludEMgPSBtYXAubGF0TG5nVG9Db250YWluZXJQb2ludChsbCk7IC8vIGNvbnZlcnQgdG8gY29udGFpbmVycG9pbnQgKHBpeGVscylcbiAgICB2YXIgcG9pbnRYID0gW3BvaW50Qy54ICsgMSwgcG9pbnRDLnldOyAvLyBhZGQgb25lIHBpeGVsIHRvIHhcblxuICAgIC8vIGNvbnZlcnQgY29udGFpbmVycG9pbnRzIHRvIGxhdGxuZydzXG4gICAgdmFyIGxhdExuZ0MgPSBtYXAuY29udGFpbmVyUG9pbnRUb0xhdExuZyhwb2ludEMpO1xuICAgIHZhciBsYXRMbmdYID0gbWFwLmNvbnRhaW5lclBvaW50VG9MYXRMbmcocG9pbnRYKTtcblxuICAgIHZhciBkaXN0YW5jZVggPSBsYXRMbmdDLmRpc3RhbmNlVG8obGF0TG5nWCk7IC8vIGNhbGN1bGF0ZSBkaXN0YW5jZSBiZXR3ZWVuIGMgYW5kIHggKGxhdGl0dWRlKVxuICAgIHJldHVybiBkaXN0YW5jZVg7XG4gIH0sXG5cbiAgLy8gZnJvbSBodHRwOi8vd3d3Lm1vdmFibGUtdHlwZS5jby51ay9zY3JpcHRzL2xhdGxvbmcuaHRtbFxuICBwb2ludERpc3RhbmNlIDogZnVuY3Rpb24gKHB0MSwgcHQyKSB7XG4gICAgdmFyIGxvbjEgPSBwdDEuY29vcmRpbmF0ZXNbMF0sXG4gICAgICBsYXQxID0gcHQxLmNvb3JkaW5hdGVzWzFdLFxuICAgICAgbG9uMiA9IHB0Mi5jb29yZGluYXRlc1swXSxcbiAgICAgIGxhdDIgPSBwdDIuY29vcmRpbmF0ZXNbMV0sXG4gICAgICBkTGF0ID0gdGhpcy5udW1iZXJUb1JhZGl1cyhsYXQyIC0gbGF0MSksXG4gICAgICBkTG9uID0gdGhpcy5udW1iZXJUb1JhZGl1cyhsb24yIC0gbG9uMSksXG4gICAgICBhID0gTWF0aC5wb3coTWF0aC5zaW4oZExhdCAvIDIpLCAyKSArIE1hdGguY29zKHRoaXMubnVtYmVyVG9SYWRpdXMobGF0MSkpXG4gICAgICAgICogTWF0aC5jb3ModGhpcy5udW1iZXJUb1JhZGl1cyhsYXQyKSkgKiBNYXRoLnBvdyhNYXRoLnNpbihkTG9uIC8gMiksIDIpLFxuICAgICAgYyA9IDIgKiBNYXRoLmF0YW4yKE1hdGguc3FydChhKSwgTWF0aC5zcXJ0KDEgLSBhKSk7XG4gICAgcmV0dXJuICg2MzcxICogYykgKiAxMDAwOyAvLyByZXR1cm5zIG1ldGVyc1xuICB9LFxuXG4gIHBvaW50SW5Qb2x5Z29uIDogZnVuY3Rpb24gKHAsIHBvbHkpIHtcbiAgICB2YXIgY29vcmRzID0gKHBvbHkudHlwZSA9PSBcIlBvbHlnb25cIikgPyBbIHBvbHkuY29vcmRpbmF0ZXMgXSA6IHBvbHkuY29vcmRpbmF0ZXNcblxuICAgIHZhciBpbnNpZGVCb3ggPSBmYWxzZVxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgY29vcmRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAodGhpcy5wb2ludEluQm91bmRpbmdCb3gocCwgdGhpcy5ib3VuZGluZ0JveEFyb3VuZFBvbHlDb29yZHMoY29vcmRzW2ldKSkpIGluc2lkZUJveCA9IHRydWVcbiAgICB9XG4gICAgaWYgKCFpbnNpZGVCb3gpIHJldHVybiBmYWxzZVxuXG4gICAgdmFyIGluc2lkZVBvbHkgPSBmYWxzZVxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgY29vcmRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAodGhpcy5wbnBvbHkocC5jb29yZGluYXRlc1sxXSwgcC5jb29yZGluYXRlc1swXSwgY29vcmRzW2ldKSkgaW5zaWRlUG9seSA9IHRydWVcbiAgICB9XG5cbiAgICByZXR1cm4gaW5zaWRlUG9seVxuICB9LFxuXG4gIHBvaW50SW5Cb3VuZGluZ0JveCA6IGZ1bmN0aW9uIChwb2ludCwgYm91bmRzKSB7XG4gICAgcmV0dXJuICEocG9pbnQuY29vcmRpbmF0ZXNbMV0gPCBib3VuZHNbMF1bMF0gfHwgcG9pbnQuY29vcmRpbmF0ZXNbMV0gPiBib3VuZHNbMV1bMF0gfHwgcG9pbnQuY29vcmRpbmF0ZXNbMF0gPCBib3VuZHNbMF1bMV0gfHwgcG9pbnQuY29vcmRpbmF0ZXNbMF0gPiBib3VuZHNbMV1bMV0pXG4gIH0sXG5cbiAgYm91bmRpbmdCb3hBcm91bmRQb2x5Q29vcmRzIDogZnVuY3Rpb24oY29vcmRzKSB7XG4gICAgdmFyIHhBbGwgPSBbXSwgeUFsbCA9IFtdXG5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGNvb3Jkc1swXS5sZW5ndGg7IGkrKykge1xuICAgICAgeEFsbC5wdXNoKGNvb3Jkc1swXVtpXVsxXSlcbiAgICAgIHlBbGwucHVzaChjb29yZHNbMF1baV1bMF0pXG4gICAgfVxuXG4gICAgeEFsbCA9IHhBbGwuc29ydChmdW5jdGlvbiAoYSxiKSB7IHJldHVybiBhIC0gYiB9KVxuICAgIHlBbGwgPSB5QWxsLnNvcnQoZnVuY3Rpb24gKGEsYikgeyByZXR1cm4gYSAtIGIgfSlcblxuICAgIHJldHVybiBbIFt4QWxsWzBdLCB5QWxsWzBdXSwgW3hBbGxbeEFsbC5sZW5ndGggLSAxXSwgeUFsbFt5QWxsLmxlbmd0aCAtIDFdXSBdXG4gIH0sXG5cbiAgLy8gUG9pbnQgaW4gUG9seWdvblxuICAvLyBodHRwOi8vd3d3LmVjc2UucnBpLmVkdS9Ib21lcGFnZXMvd3JmL1Jlc2VhcmNoL1Nob3J0X05vdGVzL3BucG9seS5odG1sI0xpc3RpbmcgdGhlIFZlcnRpY2VzXG4gIHBucG9seSA6IGZ1bmN0aW9uKHgseSxjb29yZHMpIHtcbiAgICB2YXIgdmVydCA9IFsgWzAsMF0gXVxuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBjb29yZHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGZvciAodmFyIGogPSAwOyBqIDwgY29vcmRzW2ldLmxlbmd0aDsgaisrKSB7XG4gICAgICAgIHZlcnQucHVzaChjb29yZHNbaV1bal0pXG4gICAgICB9XG4gICAgICB2ZXJ0LnB1c2goY29vcmRzW2ldWzBdKVxuICAgICAgdmVydC5wdXNoKFswLDBdKVxuICAgIH1cblxuICAgIHZhciBpbnNpZGUgPSBmYWxzZVxuICAgIGZvciAodmFyIGkgPSAwLCBqID0gdmVydC5sZW5ndGggLSAxOyBpIDwgdmVydC5sZW5ndGg7IGogPSBpKyspIHtcbiAgICAgIGlmICgoKHZlcnRbaV1bMF0gPiB5KSAhPSAodmVydFtqXVswXSA+IHkpKSAmJiAoeCA8ICh2ZXJ0W2pdWzFdIC0gdmVydFtpXVsxXSkgKiAoeSAtIHZlcnRbaV1bMF0pIC8gKHZlcnRbal1bMF0gLSB2ZXJ0W2ldWzBdKSArIHZlcnRbaV1bMV0pKSBpbnNpZGUgPSAhaW5zaWRlXG4gICAgfVxuXG4gICAgcmV0dXJuIGluc2lkZVxuICB9LFxuXG4gIG51bWJlclRvUmFkaXVzIDogZnVuY3Rpb24gKG51bWJlcikge1xuICAgIHJldHVybiBudW1iZXIgKiBNYXRoLlBJIC8gMTgwO1xuICB9XG59O1xuIl19
