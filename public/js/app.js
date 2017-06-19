(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.DWRAT = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({"/Users/jrmerz/dev/watershed/dwrat-app/lib/shared/datastore/index.js":[function(require,module,exports){
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

},{}],"/Users/jrmerz/dev/watershed/dwrat-app/lib/shared/file/index.js":[function(require,module,exports){
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

},{"./process":"/Users/jrmerz/dev/watershed/dwrat-app/lib/shared/file/process.js","./setup":"/Users/jrmerz/dev/watershed/dwrat-app/lib/shared/file/setup.js"}],"/Users/jrmerz/dev/watershed/dwrat-app/lib/shared/file/parse.js":[function(require,module,exports){
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

},{}],"/Users/jrmerz/dev/watershed/dwrat-app/lib/shared/file/process.js":[function(require,module,exports){
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

},{"./parse":"/Users/jrmerz/dev/watershed/dwrat-app/lib/shared/file/parse.js"}],"/Users/jrmerz/dev/watershed/dwrat-app/lib/shared/file/setup.js":[function(require,module,exports){
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

},{}],"/Users/jrmerz/dev/watershed/dwrat-app/lib/shared/huc/index.js":[function(require,module,exports){
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

},{"../markers/config":"/Users/jrmerz/dev/watershed/dwrat-app/lib/shared/markers/config.js"}],"/Users/jrmerz/dev/watershed/dwrat-app/lib/shared/index.js":[function(require,module,exports){
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

},{"./datastore":"/Users/jrmerz/dev/watershed/dwrat-app/lib/shared/datastore/index.js","./file":"/Users/jrmerz/dev/watershed/dwrat-app/lib/shared/file/index.js","./huc":"/Users/jrmerz/dev/watershed/dwrat-app/lib/shared/huc/index.js","./leaflet":"/Users/jrmerz/dev/watershed/dwrat-app/lib/shared/leaflet/index.js","./library":"/Users/jrmerz/dev/watershed/dwrat-app/lib/shared/library/index.js","./map":"/Users/jrmerz/dev/watershed/dwrat-app/lib/shared/map/index.js"}],"/Users/jrmerz/dev/watershed/dwrat-app/lib/shared/leaflet/canvas.js":[function(require,module,exports){
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

},{"../markers/iconRenderer":"/Users/jrmerz/dev/watershed/dwrat-app/lib/shared/markers/iconRenderer.js"}],"/Users/jrmerz/dev/watershed/dwrat-app/lib/shared/leaflet/canvasPointFeature.js":[function(require,module,exports){
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

},{"../markers/config":"/Users/jrmerz/dev/watershed/dwrat-app/lib/shared/markers/config.js","../markers/iconRenderer":"/Users/jrmerz/dev/watershed/dwrat-app/lib/shared/markers/iconRenderer.js"}],"/Users/jrmerz/dev/watershed/dwrat-app/lib/shared/leaflet/dwrat.js":[function(require,module,exports){
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

},{"../markers/iconRenderer":"/Users/jrmerz/dev/watershed/dwrat-app/lib/shared/markers/iconRenderer.js"}],"/Users/jrmerz/dev/watershed/dwrat-app/lib/shared/leaflet/index.js":[function(require,module,exports){
require('./canvas');
require('./dwrat');
require('../../../node_modules/leaflet-canvas-geojson/src/layer.js');

},{"../../../node_modules/leaflet-canvas-geojson/src/layer.js":"/Users/jrmerz/dev/watershed/dwrat-app/node_modules/leaflet-canvas-geojson/src/layer.js","./canvas":"/Users/jrmerz/dev/watershed/dwrat-app/lib/shared/leaflet/canvas.js","./dwrat":"/Users/jrmerz/dev/watershed/dwrat-app/lib/shared/leaflet/dwrat.js"}],"/Users/jrmerz/dev/watershed/dwrat-app/lib/shared/legend/index.js":[function(require,module,exports){
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

},{"../markers/config":"/Users/jrmerz/dev/watershed/dwrat-app/lib/shared/markers/config.js","../markers/droughtIcon":"/Users/jrmerz/dev/watershed/dwrat-app/lib/shared/markers/droughtIcon.js","./template":"/Users/jrmerz/dev/watershed/dwrat-app/lib/shared/legend/template.js"}],"/Users/jrmerz/dev/watershed/dwrat-app/lib/shared/legend/template.js":[function(require,module,exports){
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

},{}],"/Users/jrmerz/dev/watershed/dwrat-app/lib/shared/library/index.js":[function(require,module,exports){
var files = [];

var public_dir_root = 'https://docs.google.com/spreadsheets/d/1ACi7P0pOy-JRjtw6HribQphhEOZ-0-CkQ_mqnyCfJcI/gviz/tq';
var popup, body, file, map, toast;

function init(config) {
  file = config.file;
  map = config.map;

  var query = new google.visualization.Query(public_dir_root);
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

},{}],"/Users/jrmerz/dev/watershed/dwrat-app/lib/shared/map/geojson.js":[function(require,module,exports){
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

},{"../leaflet/canvasPointFeature":"/Users/jrmerz/dev/watershed/dwrat-app/lib/shared/leaflet/canvasPointFeature.js","../markers":"/Users/jrmerz/dev/watershed/dwrat-app/lib/shared/markers/index.js","../markers/config":"/Users/jrmerz/dev/watershed/dwrat-app/lib/shared/markers/config.js"}],"/Users/jrmerz/dev/watershed/dwrat-app/lib/shared/map/index.js":[function(require,module,exports){
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

  var wms1 = L.esri.dynamicMapLayer({
    url: "http://atlas.cws.ucdavis.edu/arcgis/rest/services/CalWater_Hydrologic_Unit/MapServer"
  }).addTo(map);

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

},{"../legend":"/Users/jrmerz/dev/watershed/dwrat-app/lib/shared/legend/index.js","./geojson":"/Users/jrmerz/dev/watershed/dwrat-app/lib/shared/map/geojson.js"}],"/Users/jrmerz/dev/watershed/dwrat-app/lib/shared/markers/config.js":[function(require,module,exports){
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

},{}],"/Users/jrmerz/dev/watershed/dwrat-app/lib/shared/markers/droughtIcon.js":[function(require,module,exports){
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

},{"./iconRenderer":"/Users/jrmerz/dev/watershed/dwrat-app/lib/shared/markers/iconRenderer.js"}],"/Users/jrmerz/dev/watershed/dwrat-app/lib/shared/markers/iconRenderer.js":[function(require,module,exports){
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

},{"./utils":"/Users/jrmerz/dev/watershed/dwrat-app/lib/shared/markers/utils.js"}],"/Users/jrmerz/dev/watershed/dwrat-app/lib/shared/markers/index.js":[function(require,module,exports){
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

},{}],"/Users/jrmerz/dev/watershed/dwrat-app/lib/shared/markers/utils.js":[function(require,module,exports){
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

},{}],"/Users/jrmerz/dev/watershed/dwrat-app/node_modules/leaflet-canvas-geojson/src/layer.js":[function(require,module,exports){
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

},{"./utils":"/Users/jrmerz/dev/watershed/dwrat-app/node_modules/leaflet-canvas-geojson/src/utils.js"}],"/Users/jrmerz/dev/watershed/dwrat-app/node_modules/leaflet-canvas-geojson/src/utils.js":[function(require,module,exports){
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

},{}]},{},["/Users/jrmerz/dev/watershed/dwrat-app/lib/shared/index.js"])("/Users/jrmerz/dev/watershed/dwrat-app/lib/shared/index.js")
});
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9ncnVudC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJsaWIvc2hhcmVkL2RhdGFzdG9yZS9pbmRleC5qcyIsImxpYi9zaGFyZWQvZmlsZS9pbmRleC5qcyIsImxpYi9zaGFyZWQvZmlsZS9wYXJzZS5qcyIsImxpYi9zaGFyZWQvZmlsZS9wcm9jZXNzLmpzIiwibGliL3NoYXJlZC9maWxlL3NldHVwLmpzIiwibGliL3NoYXJlZC9odWMvaW5kZXguanMiLCJsaWIvc2hhcmVkL2luZGV4LmpzIiwibGliL3NoYXJlZC9sZWFmbGV0L2NhbnZhcy5qcyIsImxpYi9zaGFyZWQvbGVhZmxldC9jYW52YXNQb2ludEZlYXR1cmUuanMiLCJsaWIvc2hhcmVkL2xlYWZsZXQvZHdyYXQuanMiLCJsaWIvc2hhcmVkL2xlYWZsZXQvaW5kZXguanMiLCJsaWIvc2hhcmVkL2xlZ2VuZC9pbmRleC5qcyIsImxpYi9zaGFyZWQvbGVnZW5kL3RlbXBsYXRlLmpzIiwibGliL3NoYXJlZC9saWJyYXJ5L2luZGV4LmpzIiwibGliL3NoYXJlZC9tYXAvZ2VvanNvbi5qcyIsImxpYi9zaGFyZWQvbWFwL2luZGV4LmpzIiwibGliL3NoYXJlZC9tYXJrZXJzL2NvbmZpZy5qcyIsImxpYi9zaGFyZWQvbWFya2Vycy9kcm91Z2h0SWNvbi5qcyIsImxpYi9zaGFyZWQvbWFya2Vycy9pY29uUmVuZGVyZXIuanMiLCJsaWIvc2hhcmVkL21hcmtlcnMvaW5kZXguanMiLCJsaWIvc2hhcmVkL21hcmtlcnMvdXRpbHMuanMiLCJub2RlX21vZHVsZXMvbGVhZmxldC1jYW52YXMtZ2VvanNvbi9zcmMvbGF5ZXIuanMiLCJub2RlX21vZHVsZXMvbGVhZmxldC1jYW52YXMtZ2VvanNvbi9zcmMvdXRpbHMuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4TEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMUtBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pNQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbkNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RCQTtBQUNBO0FBQ0E7QUFDQTs7O0FDSEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUN2SUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNiQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMUhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQ3pEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ2xLQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwaEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwidmFyIGRhdGEgPSB7XG4gIGFsbCA6IFtdLFxuICBub0RlbWFuZCA6IFtdLFxuICBmZWF0dXJlcyA6IFtdXG59O1xuXG5tb2R1bGUuZXhwb3J0cy5zZXQgPSBmdW5jdGlvbihwb2ludHMpIHtcbiAgZGF0YS5hbGwgPSBwb2ludHM7XG5cbiAgdG1wID0gW107XG4gIGZvciggdmFyIGkgPSBwb2ludHMubGVuZ3RoLTE7IGkgPj0gMDsgaS0tICkge1xuICAgIGlmKCBwb2ludHNbaV0ucHJvcGVydGllcy5hbGxvY2F0aW9ucyAmJiBwb2ludHNbaV0ucHJvcGVydGllcy5hbGxvY2F0aW9ucy5sZW5ndGggPiAwICkge1xuXG4gICAgICB2YXIgZGVtYW5kID0gcG9pbnRzW2ldLnByb3BlcnRpZXMuYWxsb2NhdGlvbnNbMF0uZGVtYW5kO1xuICAgICAgaWYoIGRlbWFuZCAhPT0gMCApIHRtcC5wdXNoKHBvaW50c1tpXSk7XG4gICAgfVxuICB9XG4gIGRhdGEubm9EZW1hbmQgPSB0bXA7XG59O1xuXG5tb2R1bGUuZXhwb3J0cy5nZXQgPSBmdW5jdGlvbihub0RlbWFuZCkge1xuICBpZiggbm9EZW1hbmQgKSByZXR1cm4gZGF0YS5ub0RlbWFuZDtcbiAgcmV0dXJuIGRhdGEuYWxsO1xufTtcblxubW9kdWxlLmV4cG9ydHMuY2xlYXJGZWF0dXJlcyA9IGZ1bmN0aW9uKCl7XG4gIGRhdGEuZmVhdHVyZXMgPSBbXTtcbn07XG5cbm1vZHVsZS5leHBvcnRzLmFkZEZlYXR1cmUgPSBmdW5jdGlvbihmZWF0dXJlKSB7XG4gIGRhdGEuZmVhdHVyZXMucHVzaChmZWF0dXJlKTtcbn07XG5cbm1vZHVsZS5leHBvcnRzLmdldEZlYXR1cmVzID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiBkYXRhLmZlYXR1cmVzO1xufTtcbiIsInZhciBwcm9jZXNzID0gcmVxdWlyZSgnLi9wcm9jZXNzJyk7XG5cbnZhciBRVUVSWV9TSVpFID0gMTAwMDtcbnZhciBxdWVyeVJvb3QgPSAnaHR0cDovL2dpc3B1YmxpYy53YXRlcmJvYXJkcy5jYS5nb3YvYXJjZ2lzL3Jlc3Qvc2VydmljZXMvV2F0ZXJfUmlnaHRzL1BvaW50c19vZl9EaXZlcnNpb24vTWFwU2VydmVyLzAvcXVlcnknO1xudmFyIHF1ZXJ5QXBwSWRWYXIgPSAnV0JHSVMuUG9pbnRzX29mX0RpdmVyc2lvbi5BUFBMX0lEJztcbnZhciBxdWVyeUxhdGl0dWRlID0gJ1dCR0lTLlBvaW50c19vZl9EaXZlcnNpb24uTEFUSVRVREUnO1xudmFyIHF1ZXJ5TG9uZ2l0dWRlID0gJ1dCR0lTLlBvaW50c19vZl9EaXZlcnNpb24uTE9OR0lUVURFJztcbnZhciBxdWVyeU91dGZpZWxkcyA9ICBbcXVlcnlBcHBJZFZhciwgcXVlcnlMb25naXR1ZGUsIHF1ZXJ5TGF0aXR1ZGVdLmpvaW4oJywnKTtcblxudmFyIHF1ZXJ5UGFyYW1zID0ge1xuICBmIDogJ2pzb24nLFxuICB3aGVyZSA6ICcnLFxuICByZXR1cm5HZW9tZXRyeSA6ICdmYWxzZScsXG4gIHNwYXRpYWxSZWwgOiAnZXNyaVNwYXRpYWxSZWxJbnRlcnNlY3RzJyxcbiAgZ2VvbWV0cnkgOiAnJyxcbiAgZ2VvbWV0cnlUeXBlIDogJ2VzcmlHZW9tZXRyeUVudmVsb3BlJyxcbiAgaW5TUiA6ICcxMDIxMDAnLFxuICBvdXRGaWVsZHMgOiBxdWVyeU91dGZpZWxkcyxcbiAgb3V0U1IgOiAnMTAyMTAwJ1xufTtcblxudmFyIEhFQURFUlMgPSB7XG4gICAgYXBwbGljYXRpb25fbnVtYmVyIDoge1xuICAgICAgICByZXF1aXJlZCA6IHRydWUsXG4gICAgICAgIHR5cGUgOiAnc3RyaW5nJ1xuICAgIH0sXG4gICAgZGVtYW5kX2RhdGUgOiB7XG4gICAgICAgIHJlcXVpcmVkIDogdHJ1ZSxcbiAgICAgICAgdHlwZSA6ICdkYXRlLXN0cmluZydcbiAgICB9LFxuICAgIHdhdGVyc2hlZCA6IHtcbiAgICAgICAgcmVxdWlyZWQgOiBmYWxzZSxcbiAgICAgICAgdHlwZSA6ICdzdHJpbmcnXG4gICAgfSxcbiAgICBzZWFzb24gOiB7XG4gICAgICAgIHJlcXVpcmVkIDogZmFsc2UsXG4gICAgICAgIHR5cGUgOiAnYm9vbGVhbicsXG4gICAgfSxcbiAgICAnaHVjLTEyJyA6IHtcbiAgICAgICAgcmVxdWlyZWQgOiBmYWxzZSxcbiAgICAgICAgdHlwZSA6ICdib29sZWFuJ1xuICAgIH0sXG4gICAgd2F0ZXJfcmlnaHRfdHlwZSA6IHtcbiAgICAgICAgcmVxdWlyZWQgOiBmYWxzZSxcbiAgICAgICAgdHlwZSA6ICdzdHJpbmcnXG4gICAgfSxcbiAgICBwcmlvcml0eV9kYXRlIDoge1xuICAgICAgICByZXF1aXJlZCA6IHRydWUsXG4gICAgICAgIHR5cGUgOiAnZGF0ZS1zdHJpbmcnXG4gICAgfSxcbiAgICByaXBhcmlhbiA6IHtcbiAgICAgICAgcmVxdWlyZWQgOiBmYWxzZSxcbiAgICAgICAgdHlwZSA6ICdib29sZWFuJ1xuICAgIH0sXG4gICAgcHJlMTkxNCA6IHtcbiAgICAgICAgcmVxdWlyZWQgOiBmYWxzZSxcbiAgICAgICAgdHlwZSA6ICdib29sZWFuJ1xuICAgIH0sXG4gICAgZGVtYW5kIDoge1xuICAgICAgICByZXF1aXJlZCA6IHRydWUsXG4gICAgICAgIHR5cGUgOiAnZmxvYXQnXG4gICAgfSxcbiAgICBhbGxvY2F0aW9uIDoge1xuICAgICAgICByZXF1aXJlZCA6IHRydWUsXG4gICAgICAgIHR5cGUgOiAnZmxvYXQnXG4gICAgfVxufTtcblxudmFyIGxvY2F0aW9ucyA9IHt9LCBtYXAsIGRhdGFzdG9yZTtcblxuZnVuY3Rpb24gY3JlYXRlR2VvSnNvbihkYXRhLCBhdHRyTWFwLCBjYWxsYmFjaykge1xuICAgIC8vIGZpcnN0IGxvY2F0ZSBkYXRhXG4gICAgJCgnI2ZpbGUtbG9jYXRlJykuaHRtbCgnTG9jYXRpbmcgZGF0YS4uLicpO1xuXG4gICAgdmFyIGlkcyA9IFtdLCBrZXk7XG4gICAgdmFyIGNvbCA9IGdldEF0dHJDb2woJ2FwcGxpY2F0aW9uX251bWJlcicsIGRhdGEsIGF0dHJNYXApO1xuICAgIGZvciggdmFyIGkgPSAxOyBpIDwgZGF0YS5sZW5ndGg7IGkrKyApIHtcbiAgICAgICAgdmFyIGlkID0gZGF0YVtpXVtjb2xdO1xuICAgICAgICBpZiggIWxvY2F0aW9uc1tpZF0gKSBpZHMucHVzaChkYXRhW2ldW2NvbF0pO1xuICAgIH1cblxuICAgIGxvY2F0ZURhdGEoMCwgaWRzLCBmdW5jdGlvbigpe1xuXG4gICAgICAgICQoJyNmaWxlLWxvY2F0ZScpLmh0bWwoJ0NyZWF0aW5nIGRhdGEuLi4nKTtcblxuICAgICAgICB2YXIgaU1hcCA9IHt9O1xuICAgICAgICBmb3IoIGtleSBpbiBhdHRyTWFwICkgaU1hcFthdHRyTWFwW2tleV1dID0ga2V5O1xuXG4gICAgICAgIHZhciBnZW9Kc29uID0gW107XG4gICAgICAgIGZvciggdmFyIGkgPSAxOyBpIDwgZGF0YS5sZW5ndGg7IGkrKyApIHtcbiAgICAgICAgICAgIGlmKCAhbG9jYXRpb25zW2RhdGFbaV1bY29sXV0gKSBjb250aW51ZTtcblxuICAgICAgICAgICAgdmFyIHAgPSB7XG4gICAgICAgICAgICAgICAgdHlwZSA6ICdGZWF0dXJlJyxcbiAgICAgICAgICAgICAgICBnZW9tZXRyeSA6ICQuZXh0ZW5kKHt9LCB0cnVlLCBsb2NhdGlvbnNbZGF0YVtpXVtjb2xdXSksXG4gICAgICAgICAgICAgICAgcHJvcGVydGllcyA6IHt9XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICBmb3IoIHZhciBqID0gMDsgaiA8IGRhdGFbMF0ubGVuZ3RoOyBqKysgKSB7XG4gICAgICAgICAgICAgICAga2V5ID0gZGF0YVswXVtqXTtcbiAgICAgICAgICAgICAgICBpZiggaU1hcFtrZXldICkga2V5ID0gaU1hcFtrZXldO1xuICAgICAgICAgICAgICAgIHAucHJvcGVydGllc1trZXldID0gKEhFQURFUlNba2V5XSAmJiBIRUFERVJTW2tleV0udHlwZSA9PSAnZmxvYXQnKSA/IHBhcnNlRmxvYXQoZGF0YVtpXVtqXSkgOiBkYXRhW2ldW2pdO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBwLnByb3BlcnRpZXMuYWxsb2NhdGlvbnMgPSBbe1xuICAgICAgICAgICAgICAgIHNlYXNvbiA6IHRydWUsXG4gICAgICAgICAgICAgICAgYWxsb2NhdGlvbiA6IHAucHJvcGVydGllcy5hbGxvY2F0aW9uLFxuICAgICAgICAgICAgICAgIGRlbWFuZCA6IHAucHJvcGVydGllcy5kZW1hbmQsXG4gICAgICAgICAgICAgICAgZm9yZWNhc3QgOiBmYWxzZSxcbiAgICAgICAgICAgICAgICBkYXRlIDogcC5wcm9wZXJ0aWVzLmRlbWFuZF9kYXRlLFxuICAgICAgICAgICAgICAgIHB1YmxpY19oZWFsdGhfYmluZCA6IGZhbHNlLFxuICAgICAgICAgICAgICAgIHdyYmluZCA6IGZhbHNlLFxuICAgICAgICAgICAgICAgIHJhdGlvIDogKHAucHJvcGVydGllcy5kZW1hbmQgPiAwKSA/IChwLnByb3BlcnRpZXMuYWxsb2NhdGlvbiAvIHAucHJvcGVydGllcy5kZW1hbmQpIDogMFxuICAgICAgICAgICAgfV07XG5cbiAgICAgICAgICAgIGdlb0pzb24ucHVzaChwKTtcbiAgICAgICAgfVxuXG4gICAgICAgIG1hcC5jbGVhckdlb2pzb25MYXllcigpO1xuICAgICAgICBkYXRhc3RvcmUuc2V0KGdlb0pzb24pO1xuICAgICAgICBtYXAuZ2VvanNvbi5hZGQoZ2VvSnNvbik7XG5cbiAgICAgICAgJCgnI2ZpbGUtbG9jYXRlJykuaHRtbCgnJyk7XG4gICAgICAgIGNhbGxiYWNrKCk7XG4gICAgfSk7XG59XG5cbmZ1bmN0aW9uIGdldEF0dHJDb2woYXR0ciwgZGF0YSwgbWFwKSB7XG4gICAgaWYoIG1hcFthdHRyXSApIHJldHVybiBkYXRhWzBdLmluZGV4T2YobWFwW2F0dHJdKTtcbiAgICByZXR1cm4gZGF0YVswXS5pbmRleE9mKGF0dHIpO1xufVxuXG5mdW5jdGlvbiBsb2NhdGVEYXRhKGluZGV4LCBpZHMsIGNhbGxiYWNrKSB7XG5cbiAgICBpZiggaW5kZXgrMSA+PSBpZHMubGVuZ3RoICkge1xuICAgICAgICBjYWxsYmFjaygpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHZhciBpZEdyb3VwID0gW107XG4gICAgICAgIFxuICAgICAgICB2YXIgaSA9IDA7XG4gICAgICAgIGZvciggaSA9IGluZGV4OyBpIDwgaW5kZXgrUVVFUllfU0laRTsgaSsrICkge1xuICAgICAgICAgICAgaWYoIGlkcy5sZW5ndGggPT0gaSApIGJyZWFrO1xuICAgICAgICAgICAgaWRHcm91cC5wdXNoKGlkc1tpXSk7XG4gICAgICAgIH1cbiAgICAgICAgaW5kZXggKz0gUVVFUllfU0laRTtcbiAgICAgICAgY29uc29sZS5sb2coaW5kZXgpO1xuXG4gICAgICAgIHZhciBwYXJhbXMgPSAkLmV4dGVuZCh0cnVlLCB7fSwgcXVlcnlQYXJhbXMpO1xuICAgICAgICBwYXJhbXMud2hlcmUgPSBxdWVyeUFwcElkVmFyICsgJyBpbiAoXFwnJyArIGlkR3JvdXAuam9pbignXFwnLFxcJycpICsgJ1xcJyknO1xuXG4gICAgICAgICQucG9zdChxdWVyeVJvb3QsIHBhcmFtcyxmdW5jdGlvbihyZXNwKXtcbiAgICAgICAgICB2YXIgZiwgaTtcbiAgICAgICAgICBmb3IoIGkgPSAwOyBpIDwgcmVzcC5mZWF0dXJlcy5sZW5ndGg7IGkrKyApIHtcbiAgICAgICAgICAgIGYgPSByZXNwLmZlYXR1cmVzW2ldLmF0dHJpYnV0ZXM7XG4gICAgICAgICAgICBsb2NhdGlvbnNbZltxdWVyeUFwcElkVmFyXV0gPSB7XG4gICAgICAgICAgICAgIHR5cGU6ICdQb2ludCcsXG4gICAgICAgICAgICAgIGNvb3JkaW5hdGVzOiBbZltxdWVyeUxvbmdpdHVkZV0sIGZbcXVlcnlMYXRpdHVkZV1dXG4gICAgICAgICAgICB9O1xuICAgICAgICAgIH1cblxuICAgICAgICAgICQoJyNmaWxlLWxvY2F0ZScpLmh0bWwoJ0xvY2F0aW5nIGRhdGEgJysoKGluZGV4L2lkcy5sZW5ndGgpLnRvRml4ZWQoMikqMTAwKSsnJS4uLicpO1xuICAgICAgICAgIGxvY2F0ZURhdGEoaW5kZXgsIGlkcywgY2FsbGJhY2spO1xuICAgICAgICB9LCdqc29uJyk7XG4gICAgfVxufVxuXG5cblxudmFyIGZpbGUgPSB7XG4gIEhFQURFUlMgOiBIRUFERVJTLFxuICBpbml0IDogZnVuY3Rpb24ob3B0aW9ucyl7XG4gICAgbWFwID0gb3B0aW9ucy5tYXA7XG4gICAgZGF0YXN0b3JlID0gb3B0aW9ucy5kYXRhc3RvcmU7XG4gICAgb3B0aW9ucy5maWxlID0gdGhpcztcblxuICAgIHJlcXVpcmUoJy4vc2V0dXAnKShwcm9jZXNzKTtcbiAgICBwcm9jZXNzLmluaXQob3B0aW9ucyk7XG4gIH0sXG4gIGNyZWF0ZUdlb0pzb24gOiBjcmVhdGVHZW9Kc29uLFxuICBwcm9jZXNzIDogcHJvY2Vzc1xufTtcblxuXG5tb2R1bGUuZXhwb3J0cyA9IGZpbGU7XG4iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKHR5cGUsIGNvbnRlbnRzLCBjYWxsYmFjaykge1xuICAgIGlmKCB0eXBlID09ICd4bHN4JyApIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGZ1bmN0aW9uIG9uWGxzeENvbXBsZXRlKHdiKXtcbiAgICAgICAgICAgICAgICBzZWxlY3RXb3Jrc2hlZXQod2IuU2hlZXROYW1lcywgZnVuY3Rpb24oc2hlZXROYW1lKXtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGNzdiA9IFhMU1gudXRpbHMuc2hlZXRfdG9fY3N2KHdiLlNoZWV0c1tzaGVldE5hbWVdKTtcbiAgICAgICAgICAgICAgICAgICAgJC5jc3YudG9BcnJheXMoY3N2LCB7fSwgZnVuY3Rpb24oZXJyLCBkYXRhKXtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmKCBlcnIgKSByZXR1cm4gY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKG51bGwsIGRhdGEpO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdmFyIHdvcmtlciA9IG5ldyBXb3JrZXIoJ2Jvd2VyX2NvbXBvbmVudHMvanMteGxzeC94bHN4d29ya2VyLmpzJyk7XG4gICAgICAgICAgICB3b3JrZXIub25tZXNzYWdlID0gZnVuY3Rpb24oZSkge1xuICAgICAgICAgICAgICAgIHN3aXRjaChlLmRhdGEudCkge1xuICAgICAgICAgICAgICAgICAgICBjYXNlICdyZWFkeSc6IGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICBjYXNlICdlJzogY29uc29sZS5lcnJvcihlLmRhdGEuZCk7IGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICBjYXNlICd4bHN4Jzogb25YbHN4Q29tcGxldGUoSlNPTi5wYXJzZShlLmRhdGEuZCkpOyBicmVhaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgd29ya2VyLnBvc3RNZXNzYWdlKHtkOmNvbnRlbnRzLGI6dHJ1ZX0pO1xuXG4gICAgICAgIH0gY2F0Y2goZSkge1xuICAgICAgICAgICAgY2FsbGJhY2soZSk7XG4gICAgICAgIH1cblxuICAgIH0gZWxzZSBpZiggaW5mby5leHQgPT0gJ3hscycgKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBmdW5jdGlvbiBvblhsc0NvbXBsZXRlKHdiKXtcbiAgICAgICAgICAgICAgICBzZWxlY3RXb3Jrc2hlZXQod2IuU2hlZXROYW1lcywgZnVuY3Rpb24oc2hlZXROYW1lKXtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGNzdiA9IFhMUy51dGlscy5zaGVldF90b19jc3Yod2IuU2hlZXRzW3NoZWV0TmFtZV0pO1xuICAgICAgICAgICAgICAgICAgICAkLmNzdi50b0FycmF5cyhjc3YsIHt9LCBmdW5jdGlvbihlcnIsIGRhdGEpe1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYoIGVyciApIHJldHVybiBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2sobnVsbCwgZGF0YSk7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB2YXIgd29ya2VyID0gbmV3IFdvcmtlcignYm93ZXJfY29tcG9uZW50cy9qcy14bHMveGxzd29ya2VyLmpzJyk7XG4gICAgICAgICAgICB3b3JrZXIub25tZXNzYWdlID0gZnVuY3Rpb24oZSkge1xuICAgICAgICAgICAgICAgIHN3aXRjaChlLmRhdGEudCkge1xuICAgICAgICAgICAgICAgICAgICBjYXNlICdyZWFkeSc6IGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICBjYXNlICdlJzogY29uc29sZS5lcnJvcihlLmRhdGEuZCk7IGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICBjYXNlICd4bHN4Jzogb25YbHNDb21wbGV0ZShKU09OLnBhcnNlKGUuZGF0YS5kKSk7IGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICB3b3JrZXIucG9zdE1lc3NhZ2Uoe2Q6Y29udGVudHMsYjp0cnVlfSk7XG5cbiAgICAgICAgfSBjYXRjaChlKSB7XG4gICAgICAgICAgICBkZWJ1Z2dlcjtcbiAgICAgICAgICAgIHRoaXMub25Db21wbGV0ZShlLCBudWxsLCBpbmZvLCAxLCAxLCBhcnIsIGNhbGxiYWNrKTtcbiAgICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICB2YXIgb3B0aW9ucyA9IHt9O1xuICAgICAgICAgICAgLy9pZiggaW5mby5wYXJzZXIgPT0gJ2Nzdi10YWInICkgb3B0aW9ucy5zZXBhcmF0b3IgPSAnXFx0JztcblxuICAgICAgICAgICAgJC5jc3YudG9BcnJheXMoY29udGVudHMsIG9wdGlvbnMsIGZ1bmN0aW9uKGVyciwgZGF0YSl7XG4gICAgICAgICAgICAgICAgaWYoIGVyciApIHJldHVybiBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrKG51bGwsIGRhdGEpO1xuICAgICAgICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICAgICAgfSBjYXRjaChlKSB7XG4gICAgICAgICAgICBkZWJ1Z2dlcjtcbiAgICAgICAgICAgIHRoaXMub25Db21wbGV0ZShlLCBudWxsLCBpbmZvLCAxLCAxLCBhcnIsIGNhbGxiYWNrKTtcbiAgICAgICAgfVxuICAgIH1cbn1cbiIsInZhciBwYXJzZSA9IHJlcXVpcmUoJy4vcGFyc2UnKTtcblxuLy8gbmFtZXMgRFdSIGtlZXBzIHVzaW5nIHRob3VnaCB3ZSBkaXNjdXNzZWQgb3RoZXJ3aXNlLi4uXG52YXIgcHJldmlvdXNBdHRyTWFwID0ge1xuICAnYXBwbGljYXRpb25fbnVtYmVyJyA6ICdBcHBJRCcsXG4gICdkZW1hbmRfZGF0ZScgOiAnUHVsbCBEYXRlJyxcbiAgJ3ByaW9yaXR5X2RhdGUnOiAnRmlsZSBEYXRlJ1xufTtcblxudmFyIGZpbGUsIG1hcCwgZmlsZW5hbWUgPSAnJywgaHVjO1xuXG5tb2R1bGUuZXhwb3J0cy5pbml0ID0gZnVuY3Rpb24ob3B0aW9ucykge1xuICBmaWxlID0gb3B0aW9ucy5maWxlO1xuICBtYXAgPSBvcHRpb25zLm1hcDtcbiAgaHVjID0gb3B0aW9ucy5odWM7XG59O1xuXG4vLyBwcm9jZXNzIGEgZmlsZVxubW9kdWxlLmV4cG9ydHMucnVuID0gZnVuY3Rpb24oZSkge1xuICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICBlLnByZXZlbnREZWZhdWx0KCk7XG4gIHZhciBmaWxlcyA9IGUuZGF0YVRyYW5zZmVyID8gZS5kYXRhVHJhbnNmZXIuZmlsZXMgOiBlLnRhcmdldC5maWxlczsgLy8gRmlsZUxpc3Qgb2JqZWN0LlxuXG4gIGlmKCBmaWxlcy5sZW5ndGggPiAwICkge1xuICAgICQoJyNmaWxlLWxvY2F0ZScpLmh0bWwoJ0xvYWRpbmcgZmlsZS4uLicpO1xuICAgIGZpbGVuYW1lID0gZmlsZXNbMF0ubmFtZTtcbiAgICByZWFkKGZpbGVzWzBdKTtcbiAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMuc2V0RmlsZW5hbWUgPSBmdW5jdGlvbihuYW1lKSB7XG4gIGZpbGVuYW1lID0gbmFtZTtcbn07XG5cbmZ1bmN0aW9uIGltcG9ydENvbnRlbnRzKHR5cGUsIGNvbnRlbnRzLCBjYWxsYmFjaykge1xuICBwYXJzZSh0eXBlLCBjb250ZW50cywgb25GaWxlUGFyc2VkKTtcbn1cbm1vZHVsZS5leHBvcnRzLmltcG9ydENvbnRlbnRzID0gaW1wb3J0Q29udGVudHM7XG5cbmZ1bmN0aW9uIG9uRmlsZVBhcnNlZChlcnIsIGRhdGEpIHtcbiAgJCgnI2ZpbGUtbG9jYXRlJykuaHRtbCgnJyk7XG4gIG1hdGNoQ29scyhkYXRhLCBmdW5jdGlvbihjb2xNYXApe1xuXG4gICAgLy8gbm93IGxvY2F0ZSBkYXRhIGFuZCBjcmVhdGVcbiAgICBmaWxlLmNyZWF0ZUdlb0pzb24oZGF0YSwgY29sTWFwLCB1cGRhdGVVaVBvc3RJbXBvcnQpO1xuICB9KTtcbn1cbm1vZHVsZS5leHBvcnRzLm9uRmlsZVBhcnNlZCA9IG9uRmlsZVBhcnNlZDtcblxuZnVuY3Rpb24gdXBkYXRlVWlQb3N0SW1wb3J0KCkge1xuICAkKCcjZGF0ZS1zZWxlY3Rpb24nKS5oaWRlKCk7XG4gICQoJyNmaWxlLXNlbGVjdGlvbicpLmh0bWwoJzxhIGNsYXNzPVwiYnRuIGJ0bi1saW5rXCIgaWQ9XCJyZW1vdmUtZmlsZS1idG5cIj4nK2ZpbGVuYW1lKycgPGkgY2xhc3M9XCJmYSBmYS10aW1lc1wiPjwvaT48L2E+Jyk7XG5cbiAgJCgnI3JlbW92ZS1maWxlLWJ0bicpLm9uKCdjbGljaycsZnVuY3Rpb24oKXtcbiAgICBtYXAuZ2VvanNvbi5jbGVhckxheWVyKCk7XG4gICAgaHVjLmNsZWFyKCk7XG4gICAgJCgnI2RhdGUtc2VsZWN0aW9uJykuc2hvdygpO1xuICAgICQoJyNmaWxlLXNlbGVjdGlvbicpLmh0bWwoJycpO1xuICB9KTtcblxuICAkKCcjZmlsZS1pbnB1dCcpLnZhbCgnJyk7XG4gICQoJyN0b2FzdCcpLmhpZGUoKTtcbn1cblxuZnVuY3Rpb24gcmVhZChyYXcpIHtcbiAgICBfcmVzZXRVSSgpO1xuXG4gICAgdmFyIHR5cGUgPSAndGV4dCc7XG5cbiAgICB2YXIgcmVhZGVyID0gbmV3IEZpbGVSZWFkZXIoKTtcbiAgICByZWFkZXIub25sb2FkID0gZnVuY3Rpb24oZSkge1xuICAgICAgICBpbXBvcnRDb250ZW50cyh0eXBlLCBlLnRhcmdldC5yZXN1bHQpO1xuICAgIH07XG5cbiAgICBpZiggcmF3Lm5hbWUubWF0Y2goLy4qXFwueGxzeD8kLykgKSB7XG4gICAgICAgIHR5cGUgPSByYXcubmFtZS5yZXBsYWNlKC8uKlxcLi8sJycpO1xuICAgICAgICByZWFkZXIucmVhZEFzQmluYXJ5U3RyaW5nKHJhdyk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcmVhZGVyLnJlYWRBc1RleHQocmF3KTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIG1hdGNoQ29scyhkYXRhLCBjYWxsYmFjaykge1xuICAgIGlmKCBkYXRhLmxlbmd0aCA9PSAwICkgcmV0dXJuIGFsZXJ0KCdZb3VyIGZpbGUgaXMgZW1wdHknKTtcblxuICAgIHZhciBtYXRjaGVzID0gW107XG4gICAgdmFyIHJlcXVpcmVkTWlzbWF0Y2hlcyA9IFtdO1xuICAgIHZhciBtYXBwZWQgPSBwcmV2aW91c0F0dHJNYXA7XG5cbiAgICB2YXIgZmxhdHRlbiA9IFtdO1xuICAgIGZvciggdmFyIGkgPSAwOyBpIDwgZGF0YVswXS5sZW5ndGg7IGkrKyApIHtcbiAgICAgIGZsYXR0ZW4ucHVzaChkYXRhWzBdW2ldLnRvTG93ZXJDYXNlKCkpO1xuICAgIH1cblxuICAgIGZvciggdmFyIGtleSBpbiBmaWxlLkhFQURFUlMgKSB7XG4gICAgICAgIGlmKCBwcmV2aW91c0F0dHJNYXBba2V5XSAmJiBmbGF0dGVuLmluZGV4T2YocHJldmlvdXNBdHRyTWFwW2tleV0udG9Mb3dlckNhc2UoKSkgPiAtMSApIHtcbiAgICAgICAgICAgIG1hdGNoZXMucHVzaChrZXkpO1xuICAgICAgICB9IGVsc2UgaWYoIGZsYXR0ZW4uaW5kZXhPZihrZXkudG9Mb3dlckNhc2UoKSkgPT0gLTEgJiYgZmlsZS5IRUFERVJTW2tleV0ucmVxdWlyZWQgKSB7XG4gICAgICAgICAgICByZXF1aXJlZE1pc21hdGNoZXMucHVzaChrZXkpO1xuICAgICAgICB9IGVsc2UgaWYoIGZsYXR0ZW4uaW5kZXhPZihrZXkudG9Mb3dlckNhc2UoKSkgPiAtMSApIHtcbiAgICAgICAgICBpZiggZGF0YVswXS5pbmRleE9mKGtleSkgPiAtMSApIHtcbiAgICAgICAgICAgIG1hdGNoZXMucHVzaChrZXkpO1xuICAgICAgICAgIH0gZWxzZSB7IC8vIHRoZSBjYXNlIGRpZmZlcnMsIGFkZCBpdCB0byB0aGUgYXR0cmlidXRlIG1hcFxuICAgICAgICAgICAgdmFyIGluZGV4ID0gZmxhdHRlbi5pbmRleE9mKGtleS50b0xvd2VyQ2FzZSgpKTtcbiAgICAgICAgICAgIHByZXZpb3VzQXR0ck1hcFtrZXldID0gZGF0YVswXVtpbmRleF07XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgJCgnI2ZpbGUtbW9kYWwnKS5tb2RhbCgnaGlkZScpO1xuXG4gICAgaWYoIHJlcXVpcmVkTWlzbWF0Y2hlcy5sZW5ndGggPT0gMCApIHJldHVybiBjYWxsYmFjayhwcmV2aW91c0F0dHJNYXApO1xuXG4gICAgLy8gbWFrZSBzdXJlIG1vZGFsIGlzIHNob3dpbmdcbiAgICAkKCcjbWF0Y2gtbW9kYWwnKS5tb2RhbCgnc2hvdycpO1xuXG4gICAgdmFyIHRhYmxlID0gJzx0YWJsZSBjbGFzcz1cInRhYmxlXCI+JztcbiAgICBmb3IoIHZhciBpID0gMDsgaSA8IHJlcXVpcmVkTWlzbWF0Y2hlcy5sZW5ndGg7IGkrKyApIHtcbiAgICAgICAgdGFibGUgKz0gJzx0cj48dGQ+JytyZXF1aXJlZE1pc21hdGNoZXNbaV0rJzwvdGQ+PHRkPicrX2NyZWF0ZU1hdGNoU2VsZWN0b3IocmVxdWlyZWRNaXNtYXRjaGVzW2ldLCBkYXRhWzBdLCBtYXRjaGVzKSsnPC90ZD48L3RyPic7XG4gICAgfVxuICAgIHRhYmxlICs9ICc8L3RhYmxlPic7XG5cbiAgICAkKCcjbWF0Y2hUYWJsZScpLmh0bWwoJzxkaXYgc3R5bGU9XCJtYXJnaW4tdG9wOjIwcHg7Zm9udC13ZWlnaHQ6Ym9sZFwiPlBsZWFzZSBtYXRjaCB0aGUgZm9sbG93aW5nIHJlcXVpcmVkIGNvbHVtbnMgdG8gY29udGludWU8L2Rpdj4nK3RhYmxlKTtcbiAgICAkKCcubWF0Y2gtc2VsZWN0b3InKS5vbignY2hhbmdlJywgZnVuY3Rpb24oKXtcbiAgICAgICAgdmFyIGtleSA9ICQodGhpcykuYXR0cigna2V5Jyk7XG4gICAgICAgIHZhciB2YWwgPSAkKHRoaXMpLnZhbCgpO1xuXG4gICAgICAgIGlmKCB2YWwgPT0gJycgfHwgIXZhbCApIHtcbiAgICAgICAgICAgIGRlbGV0ZSBtYXBwZWRba2V5XTtcbiAgICAgICAgICAgIHJlcXVpcmVkTWlzbWF0Y2hlcy5wdXNoKGtleSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBtYXBwZWRba2V5XSA9IHZhbDtcbiAgICAgICAgICAgIHZhciBpbmRleCA9IHJlcXVpcmVkTWlzbWF0Y2hlcy5pbmRleE9mKGtleSk7XG4gICAgICAgICAgICBpZiAoaW5kZXggPiAtMSkgcmVxdWlyZWRNaXNtYXRjaGVzLnNwbGljZShpbmRleCwgMSk7XG4gICAgICAgIH1cblxuXG4gICAgICAgIGlmKCByZXF1aXJlZE1pc21hdGNoZXMubGVuZ3RoID09IDAgKSB7XG4gICAgICAgICAgICAkKCcjbWF0Y2gtbW9kYWwnKS5tb2RhbCgnaGlkZScpO1xuICAgICAgICAgICAgJCgnI21hdGNoVGFibGUnKS5odG1sKCcnKTtcbiAgICAgICAgICAgIHByZXZpb3VzQXR0ck1hcCA9IG1hcHBlZDtcbiAgICAgICAgICAgIGNhbGxiYWNrKG1hcHBlZCk7XG4gICAgICAgIH1cbiAgICB9KTtcbn1cblxuXG5mdW5jdGlvbiBfcmVzZXRVSSgpIHtcbiAgICAkKCcjbWF0Y2hUYWJsZScpLmh0bWwoJycpO1xuICAgICQoJyNmaWxlLWxvY2F0ZScpLmh0bWwoJycpO1xufVxuXG5mdW5jdGlvbiBfY3JlYXRlTWF0Y2hTZWxlY3RvcihrZXksIGFyciwgbWF0Y2hlcykge1xuICAgIHZhciBzZWxlY3QgPSAnPHNlbGVjdCBjbGFzcz1cIm1hdGNoLXNlbGVjdG9yXCIga2V5PVwiJytrZXkrJ1wiPjxvcHRpb24+PC9vcHRpb24+JztcblxuICAgIGZvciggdmFyIGkgPSAwOyBpIDwgYXJyLmxlbmd0aDsgaSsrICkge1xuICAgICAgICBpZiggbWF0Y2hlcy5pbmRleE9mKGFycltpXSkgPiAtMSApIGNvbnRpbnVlO1xuICAgICAgICBzZWxlY3QgKz0gJzxvcHRpb24gdmFsdWU9XCInK2FycltpXSsnXCI+JythcnJbaV0rJzwvb3B0aW9uPic7XG4gICAgfVxuICAgIHJldHVybiBzZWxlY3QgKyAnPC9zZWxlY3Q+Jztcbn1cblxuZnVuY3Rpb24gc2VsZWN0V29ya3NoZWV0KHNoZWV0TmFtZXMsIGNhbGxiYWNrKSB7XG4gICAgY29uc29sZS5sb2coc2hlZXROYW1lcyk7XG5cbiAgICBpZiggc2hlZXROYW1lcy5sZW5ndGggPT0gMSApIGNhbGxiYWNrKHNoZWV0TmFtZXNbMF0pO1xuXG4gICAgLy8gYWRkIFVJIGludGVyYWN0aW9uIGhlcmVcbiAgICBjYWxsYmFjayhzaGVldE5hbWVzWzBdKTtcbn1cbiIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24ocHJvY2Vzcykge1xuICAkKCcjY2xvc2UtcG9wdXAnKS5vbignY2xpY2snLCBmdW5jdGlvbigpe1xuICAgICQoJyNpbmZvJykucmVtb3ZlQ2xhc3MoJ2ZhZGVJbkRvd24nKS5hZGRDbGFzcygnc2xpZGVPdXRSaWdodCcpO1xuXG4gICAgLy9sZWdlbmQuc2VsZWN0KG51bGwpO1xuICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKXtcbiAgICAgICQoJyNpbmZvJykuaGlkZSgpLmFkZENsYXNzKCdmYWRlSW5Eb3duJykucmVtb3ZlQ2xhc3MoJ3NsaWRlT3V0UmlnaHQnKTtcbiAgICB9LCA4MDApO1xuICB9KTtcblxuICAvLyBmaWxlIHVwbG9hZCBzdHVmZlxuICAkKCcjZmlsZS1tb2RhbCcpLm1vZGFsKHtzaG93OmZhbHNlfSk7XG4gICQoJyNmaWxlLWlucHV0Jykub24oJ2NoYW5nZScsIGZ1bmN0aW9uKGUpIHtcbiAgICBwcm9jZXNzLnJ1bihlKTtcbiAgfSk7XG4gICQoJyN1cGxvYWQtYnRuJykub24oJ2NsaWNrJywgZnVuY3Rpb24oKXtcbiAgICAkKCcjZmlsZS1tb2RhbCcpLm1vZGFsKCdzaG93Jyk7XG4gIH0pO1xuXG4gICQoJ2JvZHknKS5vbignZHJhZ292ZXInLCBmdW5jdGlvbihlKXtcbiAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcblxuICAgICQoJyN1cGxvYWQtZHJvcC1tZXNzYWdlJykuc2hvdygpO1xuICAgICQoJyN3cmFwcGVyJykuY3NzKCdvcGFjaXR5JywgMC4zKTtcbiAgfSkub24oJ2RyYWdsZWF2ZScsIGZ1bmN0aW9uKGUpe1xuICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuXG4gICAgJCgnI3VwbG9hZC1kcm9wLW1lc3NhZ2UnKS5oaWRlKCk7XG4gICAgJCgnI3dyYXBwZXInKS5jc3MoJ29wYWNpdHknLDEpO1xuICB9KS5vbignZHJvcCcsIGZ1bmN0aW9uKGUpe1xuICAgICQoJyN1cGxvYWQtZHJvcC1tZXNzYWdlJykuaGlkZSgpO1xuICAgICQoJyN3cmFwcGVyJykuY3NzKCdvcGFjaXR5JywxKTtcblxuICAgIHByb2Nlc3MucnVuKGUub3JpZ2luYWxFdmVudCk7XG4gICAgJCgnI2ZpbGUtbW9kYWwnKS5tb2RhbCgnc2hvdycpO1xuXG4gIH0pO1xufTtcbiIsInZhciBtYXJrZXJDb25maWcgPSByZXF1aXJlKCcuLi9tYXJrZXJzL2NvbmZpZycpO1xuXG52YXIgbWFwO1xudmFyIGxheWVycyA9IFtdO1xudmFyIHBvaW50c0J5SHVjID0ge307XG52YXIgdXJsUHJlZml4ID0gJ2h0dHA6Ly93YXRlcnNoZWQuaWNlLnVjZGF2aXMuZWR1L3ZpenNvdXJjZS9yZXN0P3ZpZXc9Z2V0X2h1Y19ieV9pZChcXCcnO1xudmFyIHVybFBvc3RpeCA9ICdcXCcpJnRxPVNFTEVDVCAqJztcblxudmFyIGxvb2t1cFVybCA9ICdodHRwOi8vYXRsYXMuY3dzLnVjZGF2aXMuZWR1L2FyY2dpcy9yZXN0L3NlcnZpY2VzL1dhdGVyc2hlZHMvTWFwU2VydmVyLzAvcXVlcnk/JztcbnZhciBsb29rdXBQYXJhbXMgPSB7XG4gICAgd2hlcmUgOiAnJyxcbiAgICBnZW9tZXRyeVR5cGUgOiAnZXNyaUdlb21ldHJ5RW52ZWxvcGUnLFxuICAgIHNwYXRpYWxSZWwgOiAnZXNyaVNwYXRpYWxSZWxJbnRlcnNlY3RzJyxcbiAgICBvdXRGaWVsZHMgOiAnKicsXG4gICAgcmV0dXJuR2VvbWV0cnkgOiAndHJ1ZScsXG4gICAgb3V0U1IgOiAnNDMyNicsXG4gICAgZiA6ICdwanNvbidcbn07XG5cbnZhciBodWNDYWNoZSA9IHt9O1xudmFyIHJlcXVlc3RlZCA9IHt9O1xuXG52YXIgc2hvd2luZyA9IHRydWU7XG52YXIgY3VycmVudFBvaW50cyA9IG51bGw7XG5cbmZ1bmN0aW9uIGluaXQob3B0aW9ucykge1xuICBtYXAgPSBvcHRpb25zLm1hcC5nZXRMZWFmbGV0KCk7XG5cbiAgJCgnI3JlbmRlckh1Y0F2ZycpLm9uKCdjaGFuZ2UnLCBmdW5jdGlvbigpe1xuICAgIHNob3dpbmcgPSAkKHRoaXMpLmlzKCc6Y2hlY2tlZCcpO1xuICAgIG9uVmlzaWJpbGl0eVVwZGF0ZShzaG93aW5nKTtcbiAgfSk7XG59XG5cbmZ1bmN0aW9uIG9uVmlzaWJpbGl0eVVwZGF0ZSgpIHtcbiAgaWYoICFzaG93aW5nICkge1xuICAgIGNsZWFyKCk7XG4gIH0gZWxzZSBpZiggY3VycmVudFBvaW50cyAhPT0gbnVsbCApe1xuICAgIHJlbmRlcihjdXJyZW50UG9pbnRzKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBjbGVhcigpIHtcbiAgLy8gY2xlYXIgYWxsIGxheWVyc1xuICBmb3IoIHZhciBpID0gMDsgaSA8IGxheWVycy5sZW5ndGg7IGkrKyApIHtcbiAgICBtYXAucmVtb3ZlTGF5ZXIobGF5ZXJzW2ldKTtcbiAgfVxuICBsYXllcnMgPSBbXTtcbiAgcG9pbnRzQnlIdWMgPSB7fTtcbn1cblxuZnVuY3Rpb24gcmVuZGVyKHBvaW50cykge1xuICBjdXJyZW50UG9pbnRzID0gcG9pbnRzO1xuICBpZiggIXNob3dpbmcgKSByZXR1cm47XG5cbiAgY2xlYXIoKTtcblxuICAvLyBvcmdhbml6ZSBwb2ludHMgYnkgaHVjXG4gIHZhciBodWM7XG4gIGZvciggdmFyIGkgPSAwOyBpIDwgY3VycmVudFBvaW50cy5sZW5ndGg7IGkrKyApIHtcbiAgICAvLyBUT0RPOiBkaWQgcXVpbm4gY2hhbmdlIHRoaXM/XG4gICAgaHVjID0gcG9pbnRzW2ldLnByb3BlcnRpZXNbJ2h1Yy0xMiddIHx8IHBvaW50c1tpXS5wcm9wZXJ0aWVzLmh1Y18xMjtcblxuICAgIGlmKCBwb2ludHNCeUh1Y1todWNdICkgcG9pbnRzQnlIdWNbaHVjXS5wdXNoKHBvaW50c1tpXSk7XG4gICAgZWxzZSBwb2ludHNCeUh1Y1todWNdID0gW3BvaW50c1tpXV07XG4gIH1cblxuICAvLyByZXF1ZXN0IG1pc3NpbmcgaHVjIGdlb2pzb24gYW5kL29yIHJlbmRlciBodWNcbiAgZm9yKCB2YXIgaHVjIGluIHBvaW50c0J5SHVjICkge1xuICAgIGlmKCBodWMgPT09IHVuZGVmaW5lZCB8fCBodWMgPT09ICd1bmRlZmluZWQnICkge1xuICAgICAgZGVidWdnZXI7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBpZiggaHVjQ2FjaGVbaHVjXSApIHJlbmRlckh1YyhodWMpO1xuICAgIGVsc2UgaWYoICFyZXF1ZXN0ZWRbaHVjXSApIHJlcXVlc3QoaHVjKTtcbiAgfVxufVxuXG5mdW5jdGlvbiByZXF1ZXN0KGh1Y0lkKSB7XG4gIHJlcXVlc3RlZFtodWNJZF0gPSAxO1xuXG4gIHZhciBwYXJhbXMgPSAkLmV4dGVuZCh0cnVlLCB7fSwgbG9va3VwUGFyYW1zKTtcbiAgcGFyYW1zLndoZXJlID0gJ0hVQ18xMiA9IFxcJycraHVjSWQrJ1xcJyc7XG4gIHZhciBwYXJhbVRleHQgPSBbXTtcbiAgZm9yKCB2YXIga2V5IGluIHBhcmFtcyApIHtcbiAgICBwYXJhbVRleHQucHVzaChrZXkrJz0nK2VuY29kZVVSSUNvbXBvbmVudChwYXJhbXNba2V5XSkpO1xuICB9XG4gICQuZ2V0KGxvb2t1cFVybCtwYXJhbVRleHQuam9pbignJicpLCBvbkxvb2t1cFJlc3BvbnNlKTtcblxuICAvKnZhciBxdWVyeSA9IG5ldyBnb29nbGUudmlzdWFsaXphdGlvbi5RdWVyeSh1cmxQcmVmaXgraHVjSWQrdXJsUG9zdGl4KTtcbiAgcXVlcnkuc2V0VGltZW91dCg2MCo1KTsgLy8gNSBtaW4gdGltZW91dFxuICBxdWVyeS5zZW5kKGZ1bmN0aW9uKHJlc3BvbnNlKXtcbiAgICBpZiAocmVzcG9uc2UuaXNFcnJvcigpICkgcmV0dXJuIGFsZXJ0KCdFcnJvciByZXRyaWV2aW5nIEhVQyAxMiBkYXRhIGZvciBpZCBcIicraHVjSWQrJ1wiJyk7XG5cbiAgICB2YXIgZGF0YSA9IHJlc3BvbnNlLmdldERhdGFUYWJsZSgpO1xuXG4gICAgaWYoIGRhdGEuZ2V0TnVtYmVyT2ZSb3dzKCkgPT0gMCApIHtcbiAgICAgIGRlYnVnZ2VyO1xuICAgICAgcmV0dXJuIGFsZXJ0KCdFcnJvcjogaW52YWxpZCBIVUMgMTIgaWQgXCInK2h1Y0lkK1wiJ1wiKTtcbiAgICB9XG5cbiAgICB2YXIgZ2VvbWV0cnkgPSBKU09OLnBhcnNlKGRhdGEuZ2V0VmFsdWUoMCwgMCkpO1xuICAgIHZhciBnZW9qc29uRmVhdHVyZSA9IHtcbiAgICAgIFwidHlwZVwiOiBcIkZlYXR1cmVcIixcbiAgICAgIFwicHJvcGVydGllc1wiOiB7XG4gICAgICAgICAgXCJpZFwiOiBodWNJZCxcbiAgICAgIH0sXG4gICAgICBcImdlb21ldHJ5XCI6IGdlb21ldHJ5XG4gICAgfTtcbiAgICBodWNDYWNoZVtodWNJZF0gPSBnZW9qc29uRmVhdHVyZTtcblxuICAgIHJlbmRlckh1YyhodWNJZCk7XG4gIH0pOyovXG59XG5cbmZ1bmN0aW9uIG9uTG9va3VwUmVzcG9uc2UocmVzcCkge1xuICBpZiggdHlwZW9mIHJlc3AgPT09ICdzdHJpbmcnICkge1xuICAgIHJlc3AgPSBKU09OLnBhcnNlKHJlc3ApO1xuICB9XG5cbiAgaWYoIHJlc3AuZmVhdHVyZXMgJiYgcmVzcC5mZWF0dXJlcy5sZW5ndGggPiAwICkge1xuICAgIHZhciBmZWF0dXJlID0gcmVzcC5mZWF0dXJlc1swXTtcblxuXG4gICAgdmFyIGdlb2pzb24gPSB7XG4gICAgICAndHlwZSc6ICdGZWF0dXJlJyxcbiAgICAgICdwcm9wZXJ0aWVzJzogZmVhdHVyZS5hdHRyaWJ1dGVzLFxuICAgICAgJ2dlb21ldHJ5Jzoge1xuICAgICAgICB0eXBlIDogJ1BvbHlnb24nLFxuICAgICAgICBjb29yZGluYXRlcyA6IGZlYXR1cmUuZ2VvbWV0cnkucmluZ3NcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgZ2VvanNvbi5wcm9wZXJ0aWVzLmlkID0gZ2VvanNvbi5wcm9wZXJ0aWVzLkhVQ18xMjtcblxuICAgIGh1Y0NhY2hlW2dlb2pzb24ucHJvcGVydGllcy5pZF0gPSBnZW9qc29uO1xuICAgIGlmKCAhZ2VvanNvbi5wcm9wZXJ0aWVzLmlkICkge1xuICAgICAgY29uc29sZS5sb2coJ2JhZCByZXNwb25zZSBsb29raW5nIHVwIEhVQzonKTtcbiAgICAgIGNvbnNvbGUubG9nKGZlYXR1cmUpO1xuICAgIH1cblxuICAgIHJlbmRlckh1YyhnZW9qc29uLnByb3BlcnRpZXMuaWQpO1xuICB9XG59XG5cbmZ1bmN0aW9uIHJlbmRlckh1YyhpZCkge1xuICBpZiggIXNob3dpbmcgKSByZXR1cm47XG5cbiAgdmFyIHBvaW50cyA9IHBvaW50c0J5SHVjW2lkXTtcblxuICBpZiggIXBvaW50cyApIHtcbiAgICBhbGVydCgnVW5hYmxlZCB0byBsb29rdXAgcG9pbnRzIGZvciBIVUM6ICcraWQpO1xuICAgIHJldHVybjtcbiAgfVxuXG4gIC8vIGNhbGN1bGF0ZSBwZXJjZW50IGRlbWFuZFxuICB2YXIgcGVyY2VudERlbWFuZHMgPSBbXSwgZmVhdHVyZTtcbiAgZm9yKCB2YXIgaSA9IDA7IGkgPCBwb2ludHMubGVuZ3RoOyBpKysgKSB7XG4gICAgZmVhdHVyZSA9IHBvaW50c1tpXTtcblxuICAgIGlmKCBmZWF0dXJlLnByb3BlcnRpZXMuYWxsb2NhdGlvbnMgJiYgZmVhdHVyZS5wcm9wZXJ0aWVzLmFsbG9jYXRpb25zLmxlbmd0aCA+IDAgKSB7XG4gICAgICB2YXIgZGVtYW5kID0gZmVhdHVyZS5wcm9wZXJ0aWVzLmFsbG9jYXRpb25zWzBdLmRlbWFuZDtcbiAgICAgIHZhciBhbGxvY2F0aW9uID0gZmVhdHVyZS5wcm9wZXJ0aWVzLmFsbG9jYXRpb25zWzBdLmFsbG9jYXRpb247XG5cbiAgICAgIGlmKCBkZW1hbmQgIT0gMCApIHtcbiAgICAgICAgcGVyY2VudERlbWFuZHMucHVzaChhbGxvY2F0aW9uIC8gZGVtYW5kKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvLyBjYWxjIGF2ZXJhZ2VcbiAgdmFyIGF2Z1ByZWNlbnREZW1hbmQgPSAtMTtcbiAgdmFyIHRtcCA9IDA7XG4gIGZvciggdmFyIGkgPSAwOyBpIDwgcGVyY2VudERlbWFuZHMubGVuZ3RoOyBpKysgKSB7XG4gICAgdG1wICs9IHBlcmNlbnREZW1hbmRzW2ldO1xuICB9XG4gIGlmKCBwZXJjZW50RGVtYW5kcy5sZW5ndGggPiAwICkgYXZnUHJlY2VudERlbWFuZCA9IHRtcCAvIHBlcmNlbnREZW1hbmRzLmxlbmd0aDtcblxuICB2YXIgbGF5ZXIgPSBMLmdlb0pzb24oXG4gICAgaHVjQ2FjaGVbaWRdLFxuICAgIHtcbiAgICAgIHN0eWxlOiBmdW5jdGlvbihmZWF0dXJlKSB7XG4gICAgICAgIHJldHVybiBtYXJrZXJDb25maWcucGVyY2VudERlbWFuZEh1YyhhdmdQcmVjZW50RGVtYW5kKTtcbiAgICAgIH1cbiAgICB9XG4gICkuYWRkVG8obWFwKTtcblxuICBsYXllcnMucHVzaChsYXllcik7XG59XG5cbmZ1bmN0aW9uIGdldENhY2hlKCkge1xuICByZXR1cm4gaHVjQ2FjaGU7XG59XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICBpbml0IDogaW5pdCxcbiAgcmVuZGVyIDogcmVuZGVyLFxuICBjbGVhciA6IGNsZWFyLFxuICBnZXRDYWNoZSA6IGdldENhY2hlXG59O1xuIiwicmVxdWlyZSgnLi9sZWFmbGV0Jyk7IC8vIGltcG9ydCBjdXN0b20gbWFya2VycyB0byBsZWFmbGV0IG5hbWVzcGFjZSAoZ2xvYmFsKVxudmFyIG1hcCA9IHJlcXVpcmUoJy4vbWFwJyk7XG52YXIgaHVjID0gcmVxdWlyZSgnLi9odWMnKTtcbnZhciBmaWxlID0gcmVxdWlyZSgnLi9maWxlJyk7XG52YXIgZGlyZWN0b3J5ID0gcmVxdWlyZSgnLi9saWJyYXJ5Jyk7XG52YXIgZGF0YXN0b3JlID0gcmVxdWlyZSgnLi9kYXRhc3RvcmUnKTtcblxuXG52YXIgbWFwLCBnZW9Kc29uTGF5ZXI7XG52YXIgd21zTGF5ZXJzID0gW107XG52YXIgYWxsRGF0YSA9IFtdO1xuXG4vLyBzaG91bGQgYmUgZmlsbGVkIG9yIGVtcHR5O1xudmFyIHJlbmRlckRlbWFuZCA9ICdlbXB0eSc7XG52YXIgY3VycmVudFBvaW50cyA9IG51bGw7XG52YXIgbGFzdFJlc3BQb2ludHMgPSBudWxsO1xuXG4kKGRvY3VtZW50KS5vbigncmVhZHknLCBmdW5jdGlvbigpe1xuICByZXNpemUoKTtcbiAgaW5pdCgpO1xufSk7XG5cbiQod2luZG93KVxuICAub24oJ3Jlc2l6ZScsIHJlc2l6ZSk7XG5cbmZ1bmN0aW9uIGluaXQoKSB7XG4gIHZhciBjb25maWcgPSB7XG4gICAgZGF0YXN0b3JlIDogZGF0YXN0b3JlLFxuICAgIG1hcCA6IG1hcCxcbiAgICBodWMgOiBodWNcbiAgfTtcblxuICBtYXAuaW5pdChjb25maWcpO1xuICBodWMuaW5pdChjb25maWcpO1xuICBmaWxlLmluaXQoY29uZmlnKTtcbiAgZGlyZWN0b3J5LmluaXQoY29uZmlnKTtcblxuICAvLyBxdWlja2x5IGxvYWRzIC90ZXN0ZGF0YS9TYWNSaXZlci5jc3YgZm9yIHRlc3RpbmdcbiAgLy8gcmVxdWlyZSgnLi90ZXN0JykoZmlsZSk7XG59XG5cbmZ1bmN0aW9uIHJlc2l6ZSgpIHtcbiAgdmFyIGggPSB3aW5kb3cuaW5uZXJIZWlnaHQ7XG4gIHZhciB3ID0gd2luZG93LmlubmVyV2lkdGg7XG4gIGlmKCBoID09PSBudWxsICkgaCA9ICQod2luZG93KS5oZWlnaHQoKTtcbiAgaWYoIHcgPT09IG51bGwgKSB3ID0gJCh3aW5kb3cpLndpZHRoKCk7XG5cbiAgJCgnI21hcCcpLmhlaWdodChoKS53aWR0aCh3KTtcbiAgJCgnI2luZm8nKS5jc3MoJ21heC1oZWlnaHQnLCAoaC04NSkrJ3B4Jyk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICBtYXAgOiBtYXAsXG4gIGh1YyA6IGh1YyxcbiAgZmlsZSA6IGZpbGUsXG4gIGRpcmVjdG9yeSA6IGRpcmVjdG9yeSxcbiAgZHMgOiBkYXRhc3RvcmVcbn07XG4iLCJ2YXIgSWNvblJlbmRlcmVyID0gcmVxdWlyZSgnLi4vbWFya2Vycy9pY29uUmVuZGVyZXInKTtcblxuTC5JY29uLkNhbnZhcyA9IEwuSWNvbi5leHRlbmQoe1xuICAgIG9wdGlvbnM6IHtcbiAgICAgICAgaWNvblNpemU6IG5ldyBMLlBvaW50KDIwLCAyMCksIC8vIEhhdmUgdG8gYmUgc3VwcGxpZWRcbiAgICAgICAgY2xhc3NOYW1lOiAnbGVhZmxldC1jYW52YXMtaWNvbidcbiAgICB9LFxuXG4gICAgY3JlYXRlSWNvbjogZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2NhbnZhcycpO1xuICAgICAgICB0aGlzLl9zZXRJY29uU3R5bGVzKGUsICdpY29uJyk7XG5cbiAgICAgICAgZS53aWR0aCA9IHRoaXMub3B0aW9ucy53aWR0aDtcbiAgICAgICAgZS5oZWlnaHQgPSB0aGlzLm9wdGlvbnMuaGVpZ2h0O1xuXG4gICAgICAgIGUuc3R5bGUubWFyZ2luVG9wID0gKC0xKnRoaXMub3B0aW9ucy53aWR0aC8yKSsncHgnO1xuICAgICAgICBlLnN0eWxlLm1hcmdpbkxlZnQgPSAoLTEqdGhpcy5vcHRpb25zLmhlaWdodC8yKSsncHgnO1xuXG4gICAgICAgIGUuc3R5bGUud2lkdGggPSB0aGlzLm9wdGlvbnMud2lkdGgrJ3B4JztcbiAgICAgICAgZS5zdHlsZS5oZWlnaHQgPXRoaXMub3B0aW9ucy5oZWlnaHQrJ3B4JztcblxuICAgICAgICB0aGlzLmRyYXcoZS5nZXRDb250ZXh0KCcyZCcpKTtcblxuICAgICAgICByZXR1cm4gZTtcbiAgICB9LFxuXG4gICAgY3JlYXRlU2hhZG93OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH0sXG5cblxuICAgIGRyYXc6IGZ1bmN0aW9uKGN0eCkge1xuICAgICAgSWNvblJlbmRlcmVyKGN0eCwgdGhpcy5vcHRpb25zKTtcbiAgICB9XG59KTtcbiIsInZhciBtYXJrZXJDb25maWcgPSByZXF1aXJlKCcuLi9tYXJrZXJzL2NvbmZpZycpO1xudmFyIEljb25SZW5kZXJlciA9IHJlcXVpcmUoJy4uL21hcmtlcnMvaWNvblJlbmRlcmVyJyk7XG52YXIgbWFya2VycyA9IG1hcmtlckNvbmZpZy5kZWZhdWx0cztcblxuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKHBvaW50KSB7XG5cbiAgdmFyIHR5cGUgPSBwb2ludC5wcm9wZXJ0aWVzLnJpcGFyaWFuID8gJ3JpcGFyaWFuJyA6ICdhcHBsaWNhdGlvbic7XG4gIHZhciBhbGxvY2F0aW9uID0gJ3VuYWxsb2NhdGVkJztcblxuICBmb3IoIHZhciBpID0gMDsgaSA8IHBvaW50LnByb3BlcnRpZXMuYWxsb2NhdGlvbnMubGVuZ3RoOyBpKysgKSB7XG4gICAgaWYoIHBvaW50LnByb3BlcnRpZXMuYWxsb2NhdGlvbnNbaV0uYWxsb2NhdGlvbiA+IDAgKSBhbGxvY2F0aW9uID0gJ2FsbG9jYXRlZCc7XG4gIH1cblxuICB2YXIgb3B0aW9ucyA9ICQuZXh0ZW5kKHRydWUsIHt9LCBtYXJrZXJzW3R5cGVdW2FsbG9jYXRpb25dKTtcblxuICBpZiggcG9pbnQucHJvcGVydGllcy5hbGxvY2F0aW9ucyAmJiBwb2ludC5wcm9wZXJ0aWVzLmFsbG9jYXRpb25zLmxlbmd0aCA+IDAgKSB7XG5cbiAgICB2YXIgZGVtYW5kID0gcG9pbnQucHJvcGVydGllcy5hbGxvY2F0aW9uc1swXS5kZW1hbmQ7XG4gICAgYWxsb2NhdGlvbiA9IHBvaW50LnByb3BlcnRpZXMuYWxsb2NhdGlvbnNbMF0uYWxsb2NhdGlvbjtcblxuICAgIGlmKCBkZW1hbmQgPT09IDAgKSB7XG5cbiAgICAgICQuZXh0ZW5kKHRydWUsIG9wdGlvbnMsIG1hcmtlcnMubm9EZW1hbmQpO1xuICAgICAgcG9pbnQucHJvcGVydGllcy5ub0RlbWFuZCA9IHRydWU7XG5cbiAgICB9IGVsc2Uge1xuICAgICAgbWFya2VyQ29uZmlnLnBlcmNlbnREZW1hbmQob3B0aW9ucywgYWxsb2NhdGlvbiAvIGRlbWFuZCk7XG5cbiAgICAgIHZhciBzaXplID0gTWF0aC5zcXJ0KGRlbWFuZCkgKiAzO1xuICAgICAgaWYoIHNpemUgPiA1MCApIHNpemUgPSA1MDtcbiAgICAgIGlmKCBzaXplIDwgNyApIHNpemUgPSA3O1xuXG4gICAgICBvcHRpb25zLmhlaWdodCA9IHNpemUqMjtcbiAgICAgIG9wdGlvbnMud2lkdGggPSBzaXplKjI7XG4gICAgfVxuICB9XG5cbiAgdmFyIG1hcmtlcjtcbiAgdmFyIGQgPSAxOTcxO1xuICB0cnkge1xuICAgIGlmKCB0eXBlb2YgcG9pbnQucHJvcGVydGllcy5wcmlvcml0eV9kYXRlID09PSAnc3RyaW5nJyApIHtcbiAgICAgIGQgPSBwb2ludC5wcm9wZXJ0aWVzLnByaW9yaXR5X2RhdGUgPyBwYXJzZUludChwb2ludC5wcm9wZXJ0aWVzLnByaW9yaXR5X2RhdGUucmVwbGFjZSgvLS4qLywnJykpIDogMjAwMDtcbiAgICB9IGVsc2UgaWYgKCB0eXBlb2YgcG9pbnQucHJvcGVydGllcy5wcmlvcml0eV9kYXRlID09PSAnb2JqZWN0Jykge1xuICAgICAgZCA9IHBvaW50LnByb3BlcnRpZXMucHJpb3JpdHlfZGF0ZS5nZXRZZWFyKCkrMTkwMDtcbiAgICB9XG4gIH0gY2F0Y2goZSkge1xuICAgIGQgPSAxOTcxO1xuICB9XG5cblxuXG4gIGlmKCBwb2ludC5wcm9wZXJ0aWVzLnJpcGFyaWFuICkge1xuICAgIHBvaW50LnByb3BlcnRpZXMuX3JlbmRlcmVkX2FzID0gJ1JpcGFyaWFuJztcbiAgICBvcHRpb25zLnNpZGVzID0gMDtcbiAgICAvL21hcmtlciA9IEwuZHdyYXRNYXJrZXIobGF0bG5nLCBvcHRpb25zKTtcbiAgfSBlbHNlIGlmICggZCA8IDE5MTQgKSB7XG4gICAgcG9pbnQucHJvcGVydGllcy5fcmVuZGVyZWRfYXMgPSAnUHJlLTE5MTQgQXBwcm9wcmlhdGl2ZSc7XG4gICAgb3B0aW9ucy5zaWRlcyA9IDM7XG4gICAgb3B0aW9ucy5yb3RhdGUgPSA5MDtcbiAgICAvL21hcmtlciA9IEwuZHdyYXRNYXJrZXIobGF0bG5nLCBvcHRpb25zKTtcbiAgfSBlbHNlIHtcbiAgICBwb2ludC5wcm9wZXJ0aWVzLl9yZW5kZXJlZF9hcyA9ICdQb3N0LTE5MTQgQXBwcm9wcmlhdGl2ZSc7XG4gICAgLy9tYXJrZXIgPSBMLmR3cmF0TWFya2VyKGxhdGxuZywgb3B0aW9ucyk7XG4gIH1cblxuICBwb2ludC5wcm9wZXJ0aWVzLl9yZW5kZXIgPSBvcHRpb25zO1xuXG4gIHJldHVybiB7XG4gICAgICBnZW9qc29uIDogcG9pbnQsXG4gICAgICBzaXplIDogb3B0aW9ucy53aWR0aC8yLFxuICAgICAgcmVuZGVyIDogcmVuZGVyXG4gIH07XG59O1xuXG5mdW5jdGlvbiByZW5kZXIoY3R4LCB4eVBvaW50cywgbWFwKSB7XG4gIEljb25SZW5kZXJlcihjdHgsIHRoaXMuZ2VvanNvbi5wcm9wZXJ0aWVzLl9yZW5kZXIsIHh5UG9pbnRzKTtcbn1cbiIsInZhciBJY29uUmVuZGVyZXIgPSByZXF1aXJlKCcuLi9tYXJrZXJzL2ljb25SZW5kZXJlcicpO1xuXG5MLmR3cmF0TWFya2VyID0gZnVuY3Rpb24gKGxhdGxuZywgb3B0aW9ucykge1xuICB2YXIgbWFya2VyID0gbmV3IEwuTWFya2VyKGxhdGxuZywge1xuICAgICAgaWNvbjogbmV3IEwuSWNvbi5DYW52YXMob3B0aW9ucyksXG4gICAgICBpY29uU2l6ZTogbmV3IEwuUG9pbnQob3B0aW9ucy53aWR0aCwgb3B0aW9ucy5oZWlnaHQpLFxuICB9KTtcblxuICBtYXJrZXIuc2V0U3R5bGUgPSBmdW5jdGlvbihvcHRpb25zKSB7XG4gICAgdmFyIG8gPSB0aGlzLm9wdGlvbnMuaWNvbi5vcHRpb25zO1xuXG4gICAgJC5leHRlbmQodHJ1ZSwgbywgb3B0aW9ucyk7XG4gICAgaWYoICF0aGlzLl9pY29uICkgcmV0dXJuO1xuXG4gICAgdmFyIGN0eCA9IHRoaXMuX2ljb24uZ2V0Q29udGV4dCgnMmQnKTtcbiAgICBjdHguY2xlYXJSZWN0KDAsIDAsIG8ud2lkdGgsIG8uaGVpZ2h0KTtcblxuICAgIEljb25SZW5kZXJlcihjdHgsIG8pO1xuICB9O1xuXG4gIHJldHVybiBtYXJrZXI7XG59O1xuIiwicmVxdWlyZSgnLi9jYW52YXMnKTtcbnJlcXVpcmUoJy4vZHdyYXQnKTtcbnJlcXVpcmUoJy4uLy4uLy4uL25vZGVfbW9kdWxlcy9sZWFmbGV0LWNhbnZhcy1nZW9qc29uL3NyYy9sYXllci5qcycpO1xuIiwidmFyIERyb3VnaHRJY29uID0gcmVxdWlyZSgnLi4vbWFya2Vycy9kcm91Z2h0SWNvbicpO1xudmFyIG1hcmtlckNvbmZpZyA9IHJlcXVpcmUoJy4uL21hcmtlcnMvY29uZmlnJyk7XG52YXIgbWFya2VyVGVtcGxhdGUgPSByZXF1aXJlKCcuL3RlbXBsYXRlJyk7XG52YXIgbWFya2VycyA9IG1hcmtlckNvbmZpZy5kZWZhdWx0cztcbnZhciBtYXAsIGRhdGFzdG9yZTtcblxuZ2xvYmFsLnNldHRpbmdzID0ge1xuICByZW5kZXJEZW1hbmQgOiAnZW1wdHknXG59O1xuXG5tb2R1bGUuZXhwb3J0cy5pbml0ID0gZnVuY3Rpb24oY29uZmlnKSB7XG4gIG1hcCA9IGNvbmZpZy5tYXA7XG4gIGRhdGFzdG9yZSA9IGNvbmZpZy5kYXRhc3RvcmU7XG5cbiAgdmFyIGRlbWFuZFN0ZXBzID0gWzAsIDEsIDUwLCAxMDAsIDI1MF07XG5cbiAgdmFyIG9wdGlvbnMgPSAkLmV4dGVuZCh0cnVlLCB7fSwgbWFya2Vycy5yaXBhcmlhbi51bmFsbG9jYXRlZCk7XG4gIG9wdGlvbnMuc2lkZXMgPSAwO1xuICB2YXIgaWNvbiA9IG5ldyBEcm91Z2h0SWNvbihvcHRpb25zKTtcbiAgJCgnI2xlZ2VuZC1yaXBhcmlhbicpLmFwcGVuZCgkKGljb24uZWxlKSk7XG5cblxuICBvcHRpb25zID0gJC5leHRlbmQodHJ1ZSwge30sIG1hcmtlcnMuYXBwbGljYXRpb24udW5hbGxvY2F0ZWQpO1xuICBvcHRpb25zLnNpZGVzID0gMztcbiAgb3B0aW9ucy5yb3RhdGUgPSA5MDtcbiAgaWNvbiA9IG5ldyBEcm91Z2h0SWNvbihvcHRpb25zKTtcbiAgJCgnI2xlZ2VuZC1wcmUtYXBwcm9wcmlhdGl2ZScpLmFwcGVuZCgkKGljb24uZWxlKSk7XG5cbiAgaWNvbiA9IG5ldyBEcm91Z2h0SWNvbihtYXJrZXJzLmFwcGxpY2F0aW9uLnVuYWxsb2NhdGVkKTtcbiAgJCgnI2xlZ2VuZC1wb3N0LWFwcHJvcHJpYXRpdmUnKS5hcHBlbmQoJChpY29uLmVsZSkpO1xuXG4gIHZhciB0YWJsZSA9ICc8dGFibGUgc3R5bGU9XCJ0ZXh0LWFsaWduOmNlbnRlclwiPjx0ciBzdHlsZT1cInZlcnRpY2FsLWFsaWduOiBib3R0b21cIj4nO1xuICB2YXIgaWNvbnMgPSBbXTtcbiAgZm9yKCB2YXIgaSA9IDA7IGkgPCBkZW1hbmRTdGVwcy5sZW5ndGg7IGkrKyApIHtcbiAgICB0YWJsZSArPSAnPHRkIHN0eWxlPVwicGFkZGluZzo0cHhcIj48ZGl2IGlkPVwibGVnZW5kLWRlbWFuZC0nK2krJ1wiPjwvZGl2PjxkaXY+JytcbiAgICAgICAgICAgICAgKGRlbWFuZFN0ZXBzW2ldID09IDEgPyAnPCcgOiAnJykgK1xuICAgICAgICAgICAgICAoZGVtYW5kU3RlcHNbaV0gPT0gMjUwID8gJz4nIDogJycpICtcbiAgICAgICAgICAgICAgZGVtYW5kU3RlcHNbaV0rJzwvZGl2PjwvdGQ+JztcblxuXG4gICAgaWYoIGRlbWFuZFN0ZXBzW2ldID09PSAwICkge1xuICAgICAgb3B0aW9ucyA9ICQuZXh0ZW5kKHRydWUsIHt9LCBtYXJrZXJzLmFwcGxpY2F0aW9uLnVuYWxsb2NhdGVkKTtcbiAgICAgIG9wdGlvbnMgPSAkLmV4dGVuZCh0cnVlLCBvcHRpb25zLCBtYXJrZXJzLm5vRGVtYW5kKTtcbiAgICB9IGVsc2Uge1xuICAgICAgb3B0aW9ucyA9ICQuZXh0ZW5kKHRydWUsIHt9LCBtYXJrZXJzLmFwcGxpY2F0aW9uLnVuYWxsb2NhdGVkKTtcblxuICAgICAgdmFyIHNpemUgPSBNYXRoLnNxcnQoZGVtYW5kU3RlcHNbaV0pICogMztcbiAgICAgIGlmKCBzaXplID4gNTAgKSBzaXplID0gNTA7XG4gICAgICBpZiggc2l6ZSA8IDcgKSBzaXplID0gNztcblxuICAgICAgb3B0aW9ucy5oZWlnaHQgPSAoc2l6ZSoyKSsyO1xuICAgICAgb3B0aW9ucy53aWR0aCA9IChzaXplKjIpKzI7XG4gICAgfVxuXG4gICAgaWNvbnMucHVzaChuZXcgRHJvdWdodEljb24ob3B0aW9ucykpO1xuICB9XG4gICQoJyNsZWdlbmQtZGVtYW5kJykuaHRtbCh0YWJsZSsnPC90cj48L3RhYmxlPicpO1xuXG4gIGZvciggaSA9IDA7IGkgPCBpY29ucy5sZW5ndGg7IGkrKyApIHtcbiAgICAkKCcjbGVnZW5kLWRlbWFuZC0nK2kpLmFwcGVuZCgkKGljb25zW2ldLmVsZSkpO1xuICB9XG5cbiAgdGhpcy5yZWRyYXdQRGVtYW5kTGVnZW5kKCk7XG5cbiAgLy8gaW5pdCB0b2dnbGUgYnV0dG9uXG5cbiAgJCgnI2xlZ2VuZFRvZ2dsZScpLm9uKCdjbGljaycsIGZ1bmN0aW9uKCl7XG4gICAgaWYoIHRoaXMuaGFzQXR0cmlidXRlKCdzaG93aW5nJykgKSB7XG4gICAgICB0aGlzLnJlbW92ZUF0dHJpYnV0ZSgnc2hvd2luZycpO1xuICAgICAgJCgnI2xlZ2VuZCcpLmhpZGUoJ3Nsb3cnKTtcbiAgICAgIHRoaXMuaW5uZXJIVE1MID0gJzxpIGNsYXNzPVwiZmEgZmEtYXJyb3ctcmlnaHRcIj48L2k+JztcblxuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnNldEF0dHJpYnV0ZSgnc2hvd2luZycsICcnKTtcbiAgICAgICQoJyNsZWdlbmQnKS5zaG93KCdzbG93Jyk7XG4gICAgICB0aGlzLmlubmVySFRNTCA9ICc8aSBjbGFzcz1cImZhIGZhLWFycm93LWRvd25cIj48L2k+JztcbiAgICB9XG4gIH0pO1xuXG4gICQoJyNyZW5kZXJUeXBlRmlsbGVkJykub24oJ2NsaWNrJywgb25SZW5kZXJUeXBlQ2hhbmdlKTtcbiAgJCgnI3JlbmRlclR5cGVFbXB0eScpLm9uKCdjbGljaycsIG9uUmVuZGVyVHlwZUNoYW5nZSk7XG5cbiAgJCgnI3Nob3dOb0RlbWFuZCcpLm9uKCdjbGljaycsIGZ1bmN0aW9uKCl7XG4gICAgbWFwLmdlb2pzb24uY2xlYXJMYXllcigpO1xuICAgIHZhciBub0RlbWFuZCA9ICEkKHRoaXMpLmlzKCc6Y2hlY2tlZCcpO1xuICAgIG1hcC5nZW9qc29uLmFkZChkYXRhc3RvcmUuZ2V0KG5vRGVtYW5kKSk7XG4gIH0pO1xufTtcblxuZnVuY3Rpb24gcmVkcmF3UERlbWFuZExlZ2VuZCgpIHtcbiAgdmFyIHBlcmNlbnRTdGVwcyA9IFswLCAyNSwgNTAsIDc1LCAxMDBdLCBpO1xuXG4gIHZhciB0YWJsZSA9ICc8dGFibGUgc3R5bGU9XCJ0ZXh0LWFsaWduOmNlbnRlclwiPjx0ciBzdHlsZT1cInZlcnRpY2FsLWFsaWduOiBib3R0b21cIj4nO1xuICB2YXIgaWNvbnMgPSBbXTtcblx0Zm9yKCBpID0gMDsgaSA8IHBlcmNlbnRTdGVwcy5sZW5ndGg7IGkrKyApIHtcblx0XHR0YWJsZSArPSAnPHRkIHN0eWxlPVwicGFkZGluZzo4cHhcIj48ZGl2IGlkPVwibGVnZW5kLXByZWNlbnQtb2YtZGVtYW5kLScraSsnXCI+PC9kaXY+PGRpdj4nK1xuXHRcdFx0XHRcdHBlcmNlbnRTdGVwc1tpXSsnJTwvZGl2PjwvdGQ+JztcblxuXHRcdHZhciBvcHRpb25zID0gJC5leHRlbmQodHJ1ZSwge30sIG1hcmtlcnMuYXBwbGljYXRpb24udW5hbGxvY2F0ZWQpO1xuXG4gICAgbWFya2VyQ29uZmlnLnBlcmNlbnREZW1hbmQob3B0aW9ucywgcGVyY2VudFN0ZXBzW2ldIC8gMTAwKTtcblxuXHRcdGljb25zLnB1c2gobmV3IERyb3VnaHRJY29uKG9wdGlvbnMpKTtcblx0fVxuXHQkKCcjbGVnZW5kLXByZWNlbnQtb2YtZGVtYW5kJykuaHRtbCh0YWJsZSsnPC90cj48L3RhYmxlPicpO1xuXG5cdGZvciggaSA9IDA7IGkgPCBpY29ucy5sZW5ndGg7IGkrKyApIHtcblx0XHQkKCcjbGVnZW5kLXByZWNlbnQtb2YtZGVtYW5kLScraSkuYXBwZW5kKCQoaWNvbnNbaV0uZWxlKSk7XG5cdH1cbn07XG5tb2R1bGUuZXhwb3J0cy5yZWRyYXdQRGVtYW5kTGVnZW5kID0gcmVkcmF3UERlbWFuZExlZ2VuZDtcblxuZnVuY3Rpb24gb25SZW5kZXJUeXBlQ2hhbmdlKCkge1xuICB2YXIgc2V0dGluZ3MgPSBnbG9iYWwuc2V0dGluZ3M7XG4gIHZhciBpc0ZpbGxlZENoZWNrZWQgPSAkKCcjcmVuZGVyVHlwZUZpbGxlZCcpLmlzKCc6Y2hlY2tlZCcpO1xuICB2YXIgbmV3VmFsID0gaXNGaWxsZWRDaGVja2VkID8gJ2ZpbGxlZCcgOiAnZW1wdHknO1xuXG4gIGlmKCBzZXR0aW5ncy5yZW5kZXJEZW1hbmQgPT0gbmV3VmFsICkgcmV0dXJuO1xuICBzZXR0aW5ncy5yZW5kZXJEZW1hbmQgPSBuZXdWYWw7XG5cbiAgLy8gcmVuZGVyIGxlZ2VuZFxuICByZWRyYXdQRGVtYW5kTGVnZW5kKCk7XG5cbiAgaWYoICFjdXJyZW50UG9pbnRzICkgcmV0dXJuO1xuXG4gIG1hcC5nZW9qc29uLmNsZWFyTGF5ZXIoKTtcbiAgdmFyIG5vRGVtYW5kID0gISQodGhpcykuaXMoJzpjaGVja2VkJyk7XG4gIG1hcC5nZW9qc29uLmFkZChkYXRhc3RvcmUuZ2V0KG5vRGVtYW5kKSk7XG59XG5cbm1vZHVsZS5leHBvcnRzLnN0YW1wID0gZnVuY3Rpb24oZGF0YSkge1xuICB2YXIgdGVtcGxhdGUgPSBtYXJrZXJUZW1wbGF0ZTtcbiAgZm9yKCB2YXIga2V5IGluIGRhdGEgKSB0ZW1wbGF0ZSA9IHRlbXBsYXRlLnJlcGxhY2UoJ3t7JytrZXkrJ319JywgZGF0YVtrZXldKTtcbiAgcmV0dXJuIHRlbXBsYXRlO1xufTtcbiIsIm1vZHVsZS5leHBvcnRzID0gXG4gICc8ZGl2IGNsYXNzPVwic3BhY2VyXCI+PC9kaXY+JytcbiAgJzxoMz5XYXRlciBSaWdodC9DbGFpbSAjOiB7e2FwcGxpY2F0aW9uX251bWJlcn19PC9oMz4nK1xuICAnPGRpdiBzdHlsZT1cIm1hcmdpbjoxNXB4XCI+JytcbiAgICAnPGI+Rm9yOjwvYj4ge3tkYXRlfX08YnIgLz4nK1xuICAgICc8Yj5BbGxvY2F0aW9uOjwvYj4ge3thbGxvY2F0aW9ufX0gW0FjLWZ0L2RheV08YnIgLz4nK1xuICAgICc8Yj5EZW1hbmQ6PC9iPiB7e2RlbWFuZH19IFtBYy1mdC9kYXldJytcbiAgICAnPGJyIC8+PGI+UGVyY2VudCBvZiBEZW1hbmQ6IDwvYj57e3JhdGlvfX0lPGJyIC8+JytcbiAgICAnPGRpdiBjbGFzcz1cIndlbGwgd2VsbC1zbVwiIHN0eWxlPVwibWFyZ2luLXRvcDo1cHhcIj4nK1xuICAgICd7e3dhdGVyX3JpZ2h0X3R5cGV9fTxiciAvPicrXG4gICAgJzxiPlByaW9yaXR5IERhdGU6PC9iPiB7e3ByaW9yaXR5X2RhdGV9fScrXG4gICAgJzwvZGl2PicrXG4gICc8L2Rpdj4nO1xuIiwidmFyIGZpbGVzID0gW107XG5cbnZhciByb290ID0gJ2h0dHBzOi8vZG9jcy5nb29nbGUuY29tL3NwcmVhZHNoZWV0cy9kLzFBQ2k3UDBwT3ktSlJqdHc2SHJpYlFwaGhFT1otMC1Da1FfbXFueUNmSmNJL2d2aXovdHEnO1xudmFyIHBvcHVwLCBib2R5LCBmaWxlLCBtYXAsIHRvYXN0O1xuXG5mdW5jdGlvbiBpbml0KGNvbmZpZykge1xuICBmaWxlID0gY29uZmlnLmZpbGU7XG4gIG1hcCA9IGNvbmZpZy5tYXA7XG5cbiAgdmFyIHF1ZXJ5ID0gbmV3IGdvb2dsZS52aXN1YWxpemF0aW9uLlF1ZXJ5KHJvb3QpO1xuICBxdWVyeS5zZW5kKG9uSW5pdExvYWQpO1xuXG4gIHBvcHVwID0gJCgnI2RpcmVjdG9yeS1tb2RhbCcpLm1vZGFsKHtzaG93OiBmYWxzZX0pO1xuICBib2R5ID0gJCgnI2RpcmVjdG9yeS1tb2RhbC1ib2R5Jyk7XG5cbiAgJCgnI2RpcmVjdG9yeS1idG4nKS5vbignY2xpY2snLCBmdW5jdGlvbigpe1xuICAgIHBvcHVwLm1vZGFsKCdzaG93Jyk7XG4gIH0pO1xuXG4gIHRvYXN0ID0gJCgnPGRpdiBzdHlsZT1cImRpc3BsYXk6bm9uZTtwb3NpdGlvbjpmaXhlZDtsZWZ0OjEwcHg7IGJvdHRvbTogNTBweFwiIGNsYXNzPVwiYW5pbWF0ZWQgZmFkZUluVXBcIiBpZD1cInRvYXN0XCI+PGRpdiBjbGFzcz1cImFsZXJ0IGFsZXJ0LXN1Y2Nlc3NcIj48aSBjbGFzcz1cImZhIGZhLXNwaW5uZXIgZmEtc3BpblwiPjwvaT4gTG9hZGluZyBGaWxlLi4uPC9kaXY+PC9kaXY+Jyk7XG4gICQoJ2JvZHknKS5hcHBlbmQodG9hc3QpO1xufVxuXG5mdW5jdGlvbiBvbkluaXRMb2FkKHJlc3ApIHtcbiAgaWYgKHJlc3AuaXNFcnJvcigpKSB7XG4gICAgYWxlcnQoJ0Vycm9yIGluIGxvYWRpbmcgcHVibGljIGRpcmVjdG9yeSBsaXN0aW5nOiAnICsgcmVzcG9uc2UuZ2V0TWVzc2FnZSgpICsgJyAnICsgcmVzcG9uc2UuZ2V0RGV0YWlsZWRNZXNzYWdlKCkpO1xuICAgIHJldHVybjtcbiAgfVxuXG4gIHZhciBkYXRhID0gcmVzcC5nZXREYXRhVGFibGUoKTtcbiAgdmFyIHJvd0xlbiA9IGRhdGEuZ2V0TnVtYmVyT2ZSb3dzKCk7XG4gIHZhciBjb2xMZW4gPSBkYXRhLmdldE51bWJlck9mQ29sdW1ucygpO1xuXG4gIHZhciB0YWJsZSA9ICc8aDQ+U2VsZWN0IEZpbGUgdG8gTG9hZDwvaDQ+PHRhYmxlIGNsYXNzPVwidGFibGVcIj4nO1xuICB0YWJsZSArPSAnPHRyPjx0aD5GaWxlbmFtZTwvdGg+PHRoPlN0YXJ0IERhdGU8L3RoPjx0aD5FbmQgRGF0ZTwvdGg+PHRkPjwvdGQ+PC90cj4nO1xuICBmb3IoIHZhciBpID0gMDsgaSA8IHJvd0xlbjsgaSsrICkge1xuICAgIHZhciBmaWxlID0ge307XG4gICAgZm9yKCB2YXIgaiA9IDA7IGogPCBjb2xMZW47IGorKyApIHtcbiAgICAgIGZpbGVbZGF0YS5nZXRDb2x1bW5MYWJlbChqKV0gPSBkYXRhLmdldFZhbHVlKGksIGopO1xuICAgIH1cblxuICAgIHRhYmxlICs9IGZpbGVUb1JvdyhmaWxlLCBpKTtcblxuICAgIGZpbGVzLnB1c2goZmlsZSk7XG4gIH1cblxuICBib2R5XG4gICAgLmh0bWwodGFibGUrJzwvdGFibGU+JylcbiAgICAuZmluZCgnYVtpbmRleF0nKVxuICAgIC5vbignY2xpY2snLCBmdW5jdGlvbigpe1xuICAgICAgdmFyIGZpbGUgPSBmaWxlc1twYXJzZUludCgkKHRoaXMpLmF0dHIoJ2luZGV4JykpXTtcbiAgICAgIGxvYWQoZmlsZS5SZWdpb24rJyAnK2dldERhdGVzKGZpbGUpLCBmaWxlLklEKTtcbiAgICAgIHBvcHVwLm1vZGFsKCdoaWRlJyk7XG4gICAgfSk7XG59XG5cbmZ1bmN0aW9uIGdldERhdGVzKGZpbGUpIHtcbiAgaWYoICFmaWxlWydTdGFydCBEYXRlJ10gfHwgIWZpbGVbJ0VuZCBEYXRlJ10gKSByZXR1cm4gJyc7XG5cbiAgdmFyIHR4dCA9ICcoJztcbiAgdHh0ICs9IGZpbGVbJ1N0YXJ0IERhdGUnXSA/IHRvRGF0ZShmaWxlWydTdGFydCBEYXRlJ10pIDogJz8nO1xuICB0eHQgKz0gJyAtICc7XG4gIHR4dCArPSBmaWxlWydFbmQgRGF0ZSddID8gdG9EYXRlKGZpbGVbJ0VuZCBEYXRlJ10pIDogJz8nO1xuICByZXR1cm4gdHh0ICsgJyknO1xuXG59XG5cbmZ1bmN0aW9uIGxvYWQobmFtZSwgaWQpIHtcbiAgdG9hc3Quc2hvdygpO1xuXG4gIHZhciBxdWVyeSA9IG5ldyBnb29nbGUudmlzdWFsaXphdGlvbi5RdWVyeSgnaHR0cHM6Ly9kb2NzLmdvb2dsZS5jb20vc3ByZWFkc2hlZXRzL2QvJytpZCsnL2d2aXovdHEnKTtcbiAgcXVlcnkuc2VuZChmdW5jdGlvbihyZXNwKXtcbiAgICBpZiAocmVzcC5pc0Vycm9yKCkpIHtcbiAgICAgIHRvYXN0LmhpZGUoKTtcbiAgICAgIGFsZXJ0KCdFcnJvciBpbiBsb2FkaW5nIHB1YmxpYyBzaGVldDogJyArIHJlc3BvbnNlLmdldE1lc3NhZ2UoKSArICcgJyArIHJlc3BvbnNlLmdldERldGFpbGVkTWVzc2FnZSgpKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB2YXIgZGF0YSA9IHJlc3AuZ2V0RGF0YVRhYmxlKCk7XG4gICAgdmFyIHJvd0xlbiA9IGRhdGEuZ2V0TnVtYmVyT2ZSb3dzKCk7XG4gICAgdmFyIGNvbExlbiA9IGRhdGEuZ2V0TnVtYmVyT2ZDb2x1bW5zKCk7XG4gICAgdmFyIGNzdiA9IFtbXV07XG5cblxuICAgIGZvciggdmFyIGkgPSAwOyBpIDwgY29sTGVuOyBpKysgKSB7XG4gICAgICBjc3ZbMF0ucHVzaChkYXRhLmdldENvbHVtbkxhYmVsKGkpKTtcbiAgICB9XG5cbiAgICBmb3IoIHZhciBpID0gMDsgaSA8IHJvd0xlbjsgaSsrICkge1xuICAgICAgdmFyIHJvdyA9IFtdO1xuICAgICAgZm9yKCB2YXIgaiA9IDA7IGogPCBjb2xMZW47IGorKyApIHtcbiAgICAgICAgcm93LnB1c2goZGF0YS5nZXRWYWx1ZShpLCBqKSk7XG4gICAgICB9XG4gICAgICBjc3YucHVzaChyb3cpO1xuICAgIH1cblxuICAgIGZpbGUucHJvY2Vzcy5zZXRGaWxlbmFtZShuYW1lKTtcbiAgICBmaWxlLnByb2Nlc3Mub25GaWxlUGFyc2VkKG51bGwsIGNzdik7XG4gIH0pO1xufVxuXG5mdW5jdGlvbiBmaWxlVG9Sb3coZmlsZSwgaW5kZXgpIHtcbiAgcmV0dXJuICc8dHI+JyArXG4gICAgJzx0ZD48YSBjbGFzcz1cImJ0biBidG4tbGlua1wiIGluZGV4PVwiJytpbmRleCsnXCI+PGkgY2xhc3M9XCJmYSBmYS1kb3dubG9hZFwiPjwvaT4gJytmaWxlLlJlZ2lvbisnPC9hPjwvdGQ+JytcbiAgICAnPHRkPicrZ2V0RGF0ZShmaWxlWydTdGFydCBEYXRlJ10pKyc8L3RkPicrXG4gICAgJzx0ZD4nK2dldERhdGUoZmlsZVsnRW5kIERhdGUnXSkrJzwvdGQ+JytcbiAgICAnPHRkPjxhIGNsYXNzPVwiYnRuIGJ0bi1saW5rXCIgaHJlZj1cImh0dHBzOi8vZG9jcy5nb29nbGUuY29tL3NwcmVhZHNoZWV0cy9kLycrZmlsZS5JRCsnXCIgdGFyZ2V0PVwiX2JsYW5rXCI+PGkgY2xhc3M9XCJmYSBmYS10YWJsZVwiPjwvaT48L2E+PC90ZD4nK1xuICAnPC90cj4nO1xufVxuXG5mdW5jdGlvbiBnZXREYXRlKGQpIHtcbiAgaWYoICFkICkgcmV0dXJuICc/JztcbiAgcmV0dXJuIHRvRGF0ZShkKTtcbn1cblxuZnVuY3Rpb24gdG9EYXRlKGQpIHtcbiAgcmV0dXJuIChkLmdldFllYXIoKSsxOTAwKSsnLScrKGQuZ2V0TW9udGgoKSsxKSsnLScrZC5nZXREYXRlKCk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICBpbml0IDogaW5pdFxufTtcbiIsInZhciBtYXJrZXJDb25maWcgPSByZXF1aXJlKCcuLi9tYXJrZXJzL2NvbmZpZycpO1xudmFyIG1hcmtlclNlbGVjdG9yID0gcmVxdWlyZSgnLi4vbWFya2VycycpO1xudmFyIGNhbnZhc1BvaW50RmVhdHVyZSA9IHJlcXVpcmUoJy4uL2xlYWZsZXQvY2FudmFzUG9pbnRGZWF0dXJlJyk7XG52YXIgbWFya2VycyA9IG1hcmtlckNvbmZpZy5kZWZhdWx0cztcblxudmFyIGdlb0pzb25MYXllciwgbWFya2VyTGF5ZXI7XG52YXIgbWFwLCBodWMsIGRhdGFzdG9yZSwgbWFwTW9kdWxlO1xuXG5cbm1vZHVsZS5leHBvcnRzLmluaXQgPSBmdW5jdGlvbihjb25maWcpIHtcbiAgbWFwTW9kdWxlID0gY29uZmlnLm1hcDtcbiAgbWFwID0gY29uZmlnLm1hcC5nZXRMZWFmbGV0KCk7XG4gIGRhdGFzdG9yZSA9IGNvbmZpZy5kYXRhc3RvcmU7XG4gIGh1YyA9IGNvbmZpZy5odWM7XG5cbiAgbWFya2VyTGF5ZXIgPSBuZXcgTC5DYW52YXNHZW9qc29uTGF5ZXIoe1xuICAgIC8qb25Nb3VzZU92ZXIgOiBmdW5jdGlvbihmZWF0dXJlcykge1xuICAgICAgbWFya2VyU2VsZWN0b3IuaG92ZXIoZmVhdHVyZXMpO1xuICAgICAgdXBkYXRlTW91c2UobWFya2VyTGF5ZXIuX2NvbnRhaW5lciwgbWFya2VyTGF5ZXIuaW50ZXJzZWN0TGlzdCk7XG4gICAgfSxcbiAgICBvbk1vdXNlT3V0IDogZnVuY3Rpb24oZmVhdHVyZXMpIHtcbiAgICAgIG1hcmtlclNlbGVjdG9yLm5vaG92ZXIoZmVhdHVyZXMpO1xuICAgICAgdXBkYXRlTW91c2UobWFya2VyTGF5ZXIuX2NvbnRhaW5lciwgbWFya2VyTGF5ZXIuaW50ZXJzZWN0TGlzdCk7XG4gICAgfSwqL1xuICAgIG9uQ2xpY2sgOiBvbkZlYXR1cmVzQ2xpY2tlZFxuICB9KTtcblxuICBtYXJrZXJMYXllci5hZGRUbyhtYXApO1xuICBtYXJrZXJTZWxlY3Rvci5pbml0KG1hcmtlckxheWVyKTtcbn07XG5cbm1vZHVsZS5leHBvcnRzLmFkZCA9IGZ1bmN0aW9uKHBvaW50cykge1xuICB2YXIgc2hvd05vRGVtYW5kID0gJCgnI3Nob3dOb0RlbWFuZCcpLmlzKCc6Y2hlY2tlZCcpO1xuICBkYXRhc3RvcmUuY2xlYXJGZWF0dXJlcygpO1xuXG4gIGlmKCAhc2hvd05vRGVtYW5kICkge1xuICAgIHRtcCA9IFtdO1xuICAgIGZvciggdmFyIGkgPSBwb2ludHMubGVuZ3RoLTE7IGkgPj0gMDsgaS0tICkge1xuICAgICAgaWYoIHBvaW50c1tpXS5wcm9wZXJ0aWVzLmFsbG9jYXRpb25zICYmIHBvaW50c1tpXS5wcm9wZXJ0aWVzLmFsbG9jYXRpb25zLmxlbmd0aCA+IDAgKSB7XG5cbiAgICAgICAgdmFyIGRlbWFuZCA9IHBvaW50c1tpXS5wcm9wZXJ0aWVzLmFsbG9jYXRpb25zWzBdLmRlbWFuZDtcbiAgICAgICAgaWYoIGRlbWFuZCAhPT0gMCApIHRtcC5wdXNoKHBvaW50c1tpXSk7XG4gICAgICB9XG4gICAgfVxuICAgIHBvaW50cyA9IHRtcDtcbiAgfVxuXG4gIG1hcmtlckxheWVyLmZlYXR1cmVzID0gW107XG4gIHBvaW50cy5mb3JFYWNoKGZ1bmN0aW9uKHBvaW50KXtcbiAgICBtYXJrZXJMYXllci5hZGRGZWF0dXJlKGNhbnZhc1BvaW50RmVhdHVyZShwb2ludCkpO1xuICB9KTtcbiAgbWFya2VyTGF5ZXIucmVuZGVyKCk7XG5cbiAgY3VycmVudFBvaW50cyA9IHBvaW50cztcbiAgaHVjLnJlbmRlcihwb2ludHMpO1xufTtcblxuZnVuY3Rpb24gdXBkYXRlTW91c2UoY29udGFpbmVyLCBmZWF0dXJlcykge1xuICBpZiggZmVhdHVyZXMubGVuZ3RoID4gMCApIHtcbiAgICBjb250YWluZXIuc3R5bGUuY3Vyc29yID0gJ3BvaW50ZXInO1xuICB9IGVsc2Uge1xuICAgIGNvbnRhaW5lci5zdHlsZS5jdXJzb3IgPSAnbW92ZSc7XG4gIH1cbn1cblxuZnVuY3Rpb24gb25GZWF0dXJlc0NsaWNrZWQoZmVhdHVyZXMpIHtcbiAgdmFyIGh0bWwgPSAnJztcblxuICBtYXJrZXJTZWxlY3Rvci5zZWxlY3QoZmVhdHVyZXMpO1xuXG4gIGZvciggdmFyIGkgPSAwOyBpIDwgZmVhdHVyZXMubGVuZ3RoOyBpKysgKSB7XG4gICAgdmFyIHAgPSBmZWF0dXJlc1tpXS5wcm9wZXJ0aWVzO1xuXG4gICAgaHRtbCArPSBtYXBNb2R1bGUubGVnZW5kLnN0YW1wKHtcbiAgICAgIGFwcGxpY2F0aW9uX251bWJlciA6IHAuYXBwbGljYXRpb25fbnVtYmVyLFxuICAgICAgZGF0ZSA6IGdldERhdGUocC5hbGxvY2F0aW9uc1swXS5kYXRlKSxcbiAgICAgIGFsbG9jYXRpb24gOiBwLmFsbG9jYXRpb25zWzBdLmFsbG9jYXRpb24sXG4gICAgICBkZW1hbmQgOiBwLmFsbG9jYXRpb25zWzBdLmRlbWFuZCxcbiAgICAgIHJhdGlvIDogcC5hbGxvY2F0aW9uc1swXS5yYXRpbyAhPT0gbnVsbCA/IChwLmFsbG9jYXRpb25zWzBdLnJhdGlvKjEwMCkudG9GaXhlZCgyKSA6ICcxMDAnLFxuICAgICAgd2F0ZXJfcmlnaHRfdHlwZSA6IHAuX3JlbmRlcmVkX2FzLFxuICAgICAgcHJpb3JpdHlfZGF0ZSA6IGdldERhdGUocC5wcmlvcml0eV9kYXRlKVxuICAgIH0pO1xuICB9XG5cbiAgJCgnI2luZm8tcmVzdWx0JykuaHRtbChodG1sKTtcbiAgJCgnI2luZm8nKS5hbmltYXRlKHtcbiAgICBzY3JvbGxUb3A6ICQoJy5pbmZvLWJveCcpLmhlaWdodCgpXG4gIH0sIDMwMCk7XG59XG5cbmZ1bmN0aW9uIGdldERhdGUoZCkge1xuICBpZiggZCA9PT0gdW5kZWZpbmVkIHx8IGQgPT09IG51bGwpIHJldHVybiAnVW5rbm93bic7XG4gIGlmKCB0eXBlb2YgZCA9PT0gJ3N0cmluZycgKSByZXR1cm4gZDtcbiAgcmV0dXJuIGQudG9EYXRlU3RyaW5nKCk7XG59XG5cbm1vZHVsZS5leHBvcnRzLmNsZWFyTGF5ZXIgPSBmdW5jdGlvbigpIHtcbiAgLy9pZiggZ2VvSnNvbkxheWVyICkgbWFwLnJlbW92ZUxheWVyKGdlb0pzb25MYXllcik7XG4gIG1hcmtlckxheWVyLmZlYXR1cmVzID0gW107XG4gIG1hcmtlckxheWVyLnJlbmRlcigpO1xufTtcbiIsInZhciBtYXA7XG52YXIgYmFzZU1hcHMgPSB7fTtcbnZhciBvdmVybGF5TWFwcyA9IHt9O1xuXG52YXIgZ2VvanNvbiA9IHJlcXVpcmUoJy4vZ2VvanNvbicpO1xudmFyIGdlb2pzb25MYXllciA9IHt9O1xuXG52YXIgY3VycmVudFBvaW50cyA9IG51bGw7XG52YXIgY3VycmVudEdlb2pzb24gPSBudWxsO1xuXG5tb2R1bGUuZXhwb3J0cy5sZWdlbmQgPSByZXF1aXJlKCcuLi9sZWdlbmQnKTtcbm1vZHVsZS5leHBvcnRzLmdlb2pzb24gPSByZXF1aXJlKCcuL2dlb2pzb24nKTtcblxuXG5cbm1vZHVsZS5leHBvcnRzLmluaXQgPSBmdW5jdGlvbihvcHRpb25zKSB7XG4gIG1hcCA9IEwubWFwKCdtYXAnLHt0cmFja1Jlc2l6ZTp0cnVlfSk7XG5cbiAgLy8gYWRkIGFuIE9wZW5TdHJlZXRNYXAgdGlsZSBsYXllclxuICBMLnRpbGVMYXllcignaHR0cDovL3tzfS50aWxlLm9zbS5vcmcve3p9L3t4fS97eX0ucG5nJywge1xuICAgICAgYXR0cmlidXRpb246ICcmY29weTsgPGEgaHJlZj1cImh0dHA6Ly9vc20ub3JnL2NvcHlyaWdodFwiPk9wZW5TdHJlZXRNYXA8L2E+IGNvbnRyaWJ1dG9ycydcbiAgfSkuYWRkVG8obWFwKTtcblxuICB2YXIgd21zMSA9IEwuZXNyaS5keW5hbWljTWFwTGF5ZXIoe1xuICAgIHVybDogXCJodHRwOi8vYXRsYXMuY3dzLnVjZGF2aXMuZWR1L2FyY2dpcy9yZXN0L3NlcnZpY2VzL0NhbFdhdGVyX0h5ZHJvbG9naWNfVW5pdC9NYXBTZXJ2ZXJcIlxuICB9KS5hZGRUbyhtYXApO1xuXG4gIHZhciB3bXMyID0gTC50aWxlTGF5ZXIud21zKFwiaHR0cDovL2F0bGFzLmN3cy51Y2RhdmlzLmVkdS9hcmNnaXMvc2VydmljZXMvV2F0ZXJzaGVkcy9NYXBTZXJ2ZXIvV01TU2VydmVyXCIsIHtcbiAgICAgIGxheWVyczogJzAnLFxuICAgICAgZm9ybWF0OiAnaW1hZ2UvcG5nJyxcbiAgICAgIHRyYW5zcGFyZW50OiB0cnVlLFxuICAgICAgYXR0cmlidXRpb246IFwiXCIsXG4gICAgICBib3VuZHMgOiBMLmxhdExuZ0JvdW5kcyhcbiAgICAgICAgTC5sYXRMbmcoNDMuMzUzMTQ0LCAtMTEzLjA1ODQ0MyksXG4gICAgICAgIEwubGF0TG5nKDMyLjA0NDUyOCwgLTEyNC43MTg2MzgpXG4gICAgICApXG4gIH0pO1xuXG4gIGJhc2VNYXBzID0ge307XG4gIG92ZXJsYXlNYXBzID0ge1xuICAgICdXYXRlcnNoZWRzJzogd21zMSxcbiAgICAnSFVDIDEyJzogd21zMlxuICB9O1xuXG4gIEwuY29udHJvbC5sYXllcnMoYmFzZU1hcHMsIG92ZXJsYXlNYXBzLCB7cG9zaXRpb246ICdib3R0b21sZWZ0J30pLmFkZFRvKG1hcCk7XG5cbiAgb3B0aW9ucy5tYXAgPSB0aGlzO1xuICBnZW9qc29uLmluaXQob3B0aW9ucyk7XG4gIHRoaXMubGVnZW5kLmluaXQob3B0aW9ucyk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cy5jbGVhckdlb2pzb25MYXllciA9IGZ1bmN0aW9uKCkge1xuICBnZW9qc29uLmNsZWFyTGF5ZXIoKTtcbn07XG5tb2R1bGUuZXhwb3J0cy5nZXRMZWFmbGV0ID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiBtYXA7XG59O1xuIiwidmFyIG1hcmtlcnMgPSB7XG4gIHJpcGFyaWFuIDoge1xuICAgIGFsbG9jYXRlZCA6IHtcbiAgICAgIGZpbGxDb2xvciAgIDogXCIjMjUyNUM5XCIsXG4gICAgICBjb2xvciAgICAgICA6IFwiIzMzMzMzM1wiLFxuICAgICAgd2VpZ2h0ICAgICAgOiAxLFxuICAgICAgb3BhY2l0eSAgICAgOiAxLFxuICAgICAgZmlsbE9wYWNpdHkgOiAwLjMsXG5cdFx0XHRzaWRlcyA6IDMsXG5cdFx0XHRyb3RhdGUgOiA5MCxcbiAgICAgIHdpZHRoOiAyMCxcbiAgICAgIGhlaWdodDogMjBcbiAgICB9LFxuICAgIHVuYWxsb2NhdGVkIDoge1xuICAgICAgZmlsbENvbG9yICAgOiBcIiNmZmZmZmZcIixcbiAgICAgIGNvbG9yICAgICAgIDogXCIjMzMzMzMzXCIsXG4gICAgICB3ZWlnaHQgICAgICA6IDEsXG4gICAgICBvcGFjaXR5ICAgICA6IDEsXG4gICAgICBmaWxsT3BhY2l0eSA6IDAuMyxcblx0XHRcdHNpZGVzIDogMyxcblx0XHRcdHJvdGF0ZSA6IDkwLFxuICAgICAgd2lkdGg6IDIwLFxuICAgICAgaGVpZ2h0OiAyMFxuICAgIH1cbiAgfSxcbiAgYXBwbGljYXRpb24gOiB7XG4gICAgYWxsb2NhdGVkIDoge1xuICAgICAgZmlsbENvbG9yICAgOiBcIiMyNTI1QzlcIixcbiAgICAgIGNvbG9yICAgICAgIDogXCIjMzMzMzMzXCIsXG4gICAgICB3ZWlnaHQgICAgICA6IDEsXG4gICAgICBvcGFjaXR5ICAgICA6IDEsXG4gICAgICBmaWxsT3BhY2l0eSA6IDAuMyxcbiAgICAgIHNpZGVzICAgICAgIDogNCxcbiAgICAgIHJvdGF0ZSAgICAgIDogNDUsXG4gICAgICB3aWR0aDogMjAsXG4gICAgICBoZWlnaHQ6IDIwXG4gICAgfSxcbiAgICB1bmFsbG9jYXRlZCA6IHtcbiAgICAgIGZpbGxDb2xvciAgIDogXCIjZmZmZmZmXCIsXG4gICAgICBjb2xvciAgICAgICA6IFwiIzMzMzMzM1wiLFxuICAgICAgd2VpZ2h0ICAgICAgOiAxLFxuICAgICAgb3BhY2l0eSAgICAgOiAxLFxuICAgICAgZmlsbE9wYWNpdHkgOiAwLjMsXG4gICAgICBzaWRlcyAgICAgICA6IDQsXG4gICAgICByb3RhdGUgICAgICA6IDQ1LFxuICAgICAgd2lkdGg6IDIwLFxuICAgICAgaGVpZ2h0OiAyMFxuICAgIH1cbiAgfSxcbiAgbm9EZW1hbmQgOiB7XG4gICAgbm9GaWxsIDogdHJ1ZSxcbiAgICAvL3NpZGVzIDogMCxcbiAgICBjb2xvciA6IFwiIzMzMzMzM1wiLFxuICAgIHN0cmlrZXRocm91Z2ggOiB0cnVlLFxuICAgIHJhZGl1cyA6IDUsXG4gICAgaGVpZ2h0IDogMTIsXG4gICAgd2lkdGggOiAxMlxuICB9XG59O1xubW9kdWxlLmV4cG9ydHMuZGVmYXVsdHMgPSBtYXJrZXJzO1xuXG5tb2R1bGUuZXhwb3J0cy5wZXJjZW50RGVtYW5kID0gZnVuY3Rpb24ob3B0aW9ucywgcGVyY2VudCwgbm9EZW1hbmQpIHtcbiAgaWYoIG5vRGVtYW5kICkge1xuICAgICAkLmV4dGVuZCh0cnVlLCBvcHRpb25zLCBtYXJrZXJzLm5vRGVtYW5kKTtcbiAgICAgcmV0dXJuO1xuICB9XG5cbiAgdmFyIG87XG5cbiAgaWYoIGdsb2JhbC5zZXR0aW5ncy5yZW5kZXJEZW1hbmQgPT0gJ2ZpbGxlZCcgKSB7XG5cbiAgICBpZiggcGVyY2VudCA8PSAwICkge1xuICAgICAgb3B0aW9ucy5maWxsQ29sb3IgPSAnIzMzMyc7XG4gICAgICBvcHRpb25zLmZpbGxPcGFjaXR5ID0gMC4zO1xuICAgIH0gZWxzZSB7XG4gICAgICBvID0gcGVyY2VudDtcbiAgICAgIGlmKCBvID4gMSApIG8gPSAxO1xuICAgICAgb3B0aW9ucy5maWxsT3BhY2l0eSA9IG87XG4gICAgICBvcHRpb25zLmZpbGxDb2xvciA9ICcjMDAwMGZmJztcbiAgICB9XG5cbiAgfSBlbHNlIHtcblxuICAgIGlmKCBwZXJjZW50ID49IDEgKSB7XG4gICAgICBvcHRpb25zLmZpbGxDb2xvciA9ICcjMzMzJztcbiAgICAgIG9wdGlvbnMuZmlsbE9wYWNpdHkgPSAwLjM7XG4gICAgfSBlbHNlIHtcbiAgICAgIG8gPSAxIC0gcGVyY2VudDtcbiAgICAgIGlmKCBvID4gMSApIG8gPSAxO1xuICAgICAgaWYoIG8gPCAwICkgbyA9IDA7XG5cbiAgICAgIG9wdGlvbnMuZmlsbE9wYWNpdHkgPSBvO1xuICAgICAgb3B0aW9ucy5maWxsQ29sb3IgPSAnI2ZmMDAwMCc7XG4gICAgfVxuXG4gIH1cbiAgLy9vcHRpb25zLmZpbGxDb2xvciA9ICcjJytnZXRDb2xvcihhbGxvY2F0aW9uIC8gZGVtYW5kKTtcbn07XG5cbm1vZHVsZS5leHBvcnRzLnBlcmNlbnREZW1hbmRIdWMgPSBmdW5jdGlvbihwZXJjZW50KSB7XG4gIGlmKCBwZXJjZW50ID09IC0xICkge1xuICAgICByZXR1cm4ge1xuICAgICAgIGZpbGxDb2xvciA6ICcjZmZmZmZmJyxcbiAgICAgICBmaWxsT3BhY2l0eSA6IDAuMixcbiAgICAgICB3ZWlnaHQgOiAxLFxuICAgICAgIGNvbG9yOiAnIzMzMzMzMydcbiAgICAgfTtcbiAgfVxuXG5cbiAgaWYoIGdsb2JhbC5zZXR0aW5ncy5yZW5kZXJEZW1hbmQgPT0gJ2ZpbGxlZCcgKSB7XG5cbiAgICBpZiggcGVyY2VudCA8PSAwICkge1xuXG4gICAgICByZXR1cm4ge1xuICAgICAgICBmaWxsQ29sb3IgOiAnIzMzMzMzMycsXG4gICAgICAgIGZpbGxPcGFjaXR5IDogMC4zLFxuICAgICAgICB3ZWlnaHQgOiAyLFxuICAgICAgICBjb2xvcjogJyMzMzMzMzMnXG4gICAgICB9O1xuXG5cbiAgICB9IGVsc2Uge1xuICAgICAgdmFyIG8gPSBwZXJjZW50O1xuICAgICAgaWYoIG8gPiAwLjggKSBvID0gMC44O1xuXG4gICAgICByZXR1cm4ge1xuICAgICAgICBmaWxsQ29sb3IgOiAnIzAwMDBmZicsXG4gICAgICAgIGZpbGxPcGFjaXR5IDogbyxcbiAgICAgICAgd2VpZ2h0IDogMixcbiAgICAgICAgY29sb3I6ICcjMzMzMzMzJ1xuICAgICAgfTtcbiAgICB9XG5cbiAgfSBlbHNlIHtcblxuICAgIGlmKCBwZXJjZW50ID49IDEgKSB7XG5cbiAgICAgIHJldHVybiB7XG4gICAgICAgIGZpbGxDb2xvciA6ICcjMzMzMzMzJyxcbiAgICAgICAgZmlsbE9wYWNpdHkgOiAwLjMsXG4gICAgICAgIHdlaWdodCA6IDIsXG4gICAgICAgIGNvbG9yOiAnIzMzMzMzMydcbiAgICAgIH07XG5cbiAgICB9IGVsc2Uge1xuICAgICAgdmFyIG8gPSAxIC0gcGVyY2VudDtcbiAgICAgIGlmKCBvID4gMC44ICkgbyA9IDAuODtcbiAgICAgIGlmKCBvIDwgMCApIG8gPSAwO1xuXG4gICAgICByZXR1cm4ge1xuICAgICAgICBmaWxsQ29sb3IgOiAnI2ZmMDAwMCcsXG4gICAgICAgIGZpbGxPcGFjaXR5IDogbyxcbiAgICAgICAgd2VpZ2h0IDogMixcbiAgICAgICAgY29sb3I6ICcjMzMzMzMzJ1xuICAgICAgfTtcblxuICAgIH1cblxuICB9XG4gIC8vb3B0aW9ucy5maWxsQ29sb3IgPSAnIycrZ2V0Q29sb3IoYWxsb2NhdGlvbiAvIGRlbWFuZCk7XG59O1xuIiwidmFyIEljb25SZW5kZXJlciA9IHJlcXVpcmUoJy4vaWNvblJlbmRlcmVyJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oY29uZmlnKSB7XG4gIHRoaXMuY29uZmlnID0gY29uZmlnO1xuICB0aGlzLmVsZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2NhbnZhcycpO1xuXG4gIHRoaXMucmVkcmF3ID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIHcgPSBjb25maWcuaGVpZ2h0IHx8IDMyO1xuICAgIHZhciBoID0gY29uZmlnLndpZHRoIHx8IDMyO1xuXG4gICAgdGhpcy5lbGUuaGVpZ2h0ID0gaDtcbiAgICB0aGlzLmVsZS53aWR0aCA9IHc7XG5cbiAgICB2YXIgY3R4ID0gdGhpcy5lbGUuZ2V0Q29udGV4dChcIjJkXCIpO1xuICAgIGN0eC5jbGVhclJlY3QoMCwgMCwgdywgaCk7XG5cbiAgICBJY29uUmVuZGVyZXIoY3R4LCBjb25maWcpO1xuICB9O1xuXG4gIHRoaXMucmVkcmF3KCk7XG59O1xuIiwidmFyIHV0aWwgPSByZXF1aXJlKCcuL3V0aWxzJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oY3R4LCBjb25maWcsIHh5UG9pbnRzKSB7XG5cbiAgdmFyIHNpZGVzID0gY29uZmlnLnNpZGVzICE9PSBudWxsID8gY29uZmlnLnNpZGVzIDogNjtcbiAgdmFyIHJvdGF0ZSA9IGNvbmZpZy5yb3RhdGUgPyBjb25maWcucm90YXRlIDogMDtcbiAgdmFyIHgsIHk7XG4gIGlmKCB4eVBvaW50cyApIHtcbiAgICB4ID0geHlQb2ludHMueDtcbiAgICB5ID0geHlQb2ludHMueTtcbiAgfSBlbHNlIHtcbiAgICB4ID0gY29uZmlnLndpZHRoIC8gMjtcbiAgICB5ID0gY29uZmlnLmhlaWdodCAvIDI7XG4gIH1cblxuICB2YXIgYSA9ICgoTWF0aC5QSSAqIDIpIC8gY29uZmlnLnNpZGVzKTtcbiAgdmFyIHIgPSByb3RhdGUgKiAoTWF0aC5QSSAvIDE4MCk7XG5cbiAgdmFyIHJhZGl1cyA9IChjb25maWcud2lkdGggLyAyKSAtIDE7XG5cbiAgdmFyIGZpbGxTdHlsZSA9IHV0aWwuaGV4VG9SZ2IoY29uZmlnLmZpbGxDb2xvcik7XG4gIGZpbGxTdHlsZS5wdXNoKGNvbmZpZy5maWxsT3BhY2l0eSk7XG4gIGN0eC5maWxsU3R5bGUgPSAncmdiYSgnK2ZpbGxTdHlsZS5qb2luKCcsJykrJyknO1xuXG4gIHZhciBjb2xvciA9IGNvbmZpZy5oaWdobGlnaHQgPyAneWVsbG93JyA6IGNvbmZpZy5jb2xvcjtcbiAgaWYoIGNvbmZpZy5ob3ZlciApIGNvbG9yID0gJ29yYW5nZSc7XG4gIGN0eC5zdHJva2VTdHlsZSA9IGNvbG9yO1xuXG4gIC8vIHRoaW5rIHlvdSBuZWVkIHRvIGFkanVzdCBieSB4LCB5XG4gIGN0eC5iZWdpblBhdGgoKTtcblxuICAvLyBkcmF3IGNpcmNsZVxuICBpZiAoIHNpZGVzIDwgMyApIHtcblxuICAgIGN0eC5hcmMoeCwgeSwgcmFkaXVzLCAwLCAyKk1hdGguUEkpO1xuXG4gIH0gZWxzZSB7XG5cbiAgICB2YXIgdHgsIHR5LCBpO1xuICAgIGZvciAoaSA9IDA7IGkgPCBjb25maWcuc2lkZXM7IGkrKykge1xuICAgICAgdHggPSB4ICsgKHJhZGl1cyAqIE1hdGguY29zKGEqaS1yKSk7XG4gICAgICB0eSA9IHkgKyAocmFkaXVzICogTWF0aC5zaW4oYSppLXIpKTtcblxuICAgICAgaWYoIGkgPT09IDAgKSBjdHgubW92ZVRvKHR4LCB0eSk7XG4gICAgICBlbHNlIGN0eC5saW5lVG8odHgsIHR5KTtcbiAgICB9XG5cbiAgICBjdHgubGluZVRvKHggKyAocmFkaXVzICogTWF0aC5jb3MoLTEgKiByKSksIHkgKyAocmFkaXVzICogTWF0aC5zaW4oLTEgKiByKSkpO1xuICAgIGN0eC5jbG9zZVBhdGgoKTtcbiAgfVxuXG4gIGlmKCAhY29uZmlnLm5vRmlsbCApIGN0eC5maWxsKCk7XG4gIGN0eC5zdHJva2UoKTtcblxuICBpZiggY29uZmlnLnN0cmlrZXRocm91Z2ggKSB7XG4gICAgY3R4LmJlZ2luUGF0aCgpO1xuICAgIGlmKCB4eVBvaW50cyApIHtcbiAgICAgIHZhciB3MiA9IGNvbmZpZy53aWR0aCAvIDIsIGgyID0gY29uZmlnLmhlaWdodCAvIDI7XG4gICAgICBjdHgubW92ZVRvKHgtdzIsIHktaDIpO1xuICAgICAgY3R4LmxpbmVUbyh4K3cyIC0gMSwgeStoMiAtIDEpO1xuICAgIH0gZWxzZSB7XG4gICAgICBjdHgubW92ZVRvKDEsIDEpO1xuICAgICAgY3R4LmxpbmVUbyhjb25maWcud2lkdGggLSAxLCBjb25maWcuaGVpZ2h0IC0gMSk7XG4gICAgfVxuXG4gICAgY3R4LnN0cm9rZSgpO1xuICAgIGN0eC5jbG9zZVBhdGgoKTtcbiAgfVxufTtcbiIsInZhciBkYXRhID0ge1xuICBzZWxlY3RlZCA6IG51bGwsXG4gIGhvdmVyZWQgOiBudWxsXG59O1xudmFyIGxheWVyO1xuXG5tb2R1bGUuZXhwb3J0cy5pbml0ID0gZnVuY3Rpb24obCkge1xuICBsYXllciA9IGw7XG59O1xuXG5tb2R1bGUuZXhwb3J0cy5ob3ZlciA9IGZ1bmN0aW9uKG1hcmtlcnMpIHtcbiAgdXBkYXRlKCdob3ZlcmVkJywgJ2hvdmVyJywgbWFya2Vycyk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cy5ub2hvdmVyID0gZnVuY3Rpb24obWFya2Vycykge1xuICBpZiggIWRhdGEuaG92ZXJlZCApIHJldHVybjtcblxuICBmb3IoIHZhciBpID0gMDsgaSA8IG1hcmtlcnMubGVuZ3RoOyBpKysgKSB7XG4gICAgdmFyIGluZGV4ID0gZGF0YS5ob3ZlcmVkLmluZGV4T2YobWFya2Vyc1tpXSk7XG4gICAgaWYoIGluZGV4ID4gLTEgKSBkYXRhLmhvdmVyZWRbaW5kZXhdLnByb3BlcnRpZXMuX3JlbmRlci5ob3ZlciA9IGZhbHNlO1xuICB9XG5cbiAgbGF5ZXIucmVuZGVyKCk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cy5zZWxlY3QgPSBmdW5jdGlvbihtYXJrZXJzKSB7XG4gIHVwZGF0ZSgnc2VsZWN0ZWQnLCAnaGlnaGxpZ2h0JywgbWFya2Vycyk7XG59O1xuXG5mdW5jdGlvbiB1cGRhdGUoYXJyYXksIHByb3BlcnR5LCBtYXJrZXJzKSB7XG4gIGlmKCBkYXRhW2FycmF5XSAhPT0gbnVsbCApIHtcbiAgICBkYXRhW2FycmF5XS5mb3JFYWNoKGZ1bmN0aW9uKG1hcmtlcil7XG4gICAgICBtYXJrZXIucHJvcGVydGllcy5fcmVuZGVyW3Byb3BlcnR5XSA9IGZhbHNlO1xuICAgIH0pO1xuICB9XG5cbiAgaWYoIG1hcmtlcnMgKSB7XG4gICAgZGF0YVthcnJheV0gPSBtYXJrZXJzO1xuICAgIG1hcmtlcnMuZm9yRWFjaChmdW5jdGlvbihtYXJrZXIpe1xuICAgICAgbWFya2VyLnByb3BlcnRpZXMuX3JlbmRlcltwcm9wZXJ0eV0gPSB0cnVlO1xuICAgIH0pO1xuICB9XG5cbiAgaWYoIGxheWVyICkge1xuICAgIGxheWVyLnJlbmRlcigpO1xuICB9XG59XG4iLCJtb2R1bGUuZXhwb3J0cy5oZXhUb1JnYiA9IGZ1bmN0aW9uKGhleCkge1xuICAgIHZhciByZXN1bHQgPSAvXiM/KFthLWZcXGRdezJ9KShbYS1mXFxkXXsyfSkoW2EtZlxcZF17Mn0pJC9pLmV4ZWMoaGV4KTtcbiAgICByZXR1cm4gcmVzdWx0ID8gW1xuICAgICAgICBwYXJzZUludChyZXN1bHRbMV0sIDE2KSxcbiAgICAgICAgcGFyc2VJbnQocmVzdWx0WzJdLCAxNiksXG4gICAgICAgIHBhcnNlSW50KHJlc3VsdFszXSwgMTYpXG4gICAgXSA6IFswLDAsMF07XG59O1xuXG5tb2R1bGUuZXhwb3J0cy5nZXRDb2xvciA9IGZ1bmN0aW9uKG51bSkge1xuICBpZiggbnVtID4gMSApIG51bSA9IDE7XG4gIGlmKCBudW0gPCAwICkgbnVtID0gMDtcblxuICB2YXIgc3ByZWFkID0gTWF0aC5mbG9vcig1MTAqbnVtKSAtIDI1NTtcblxuICBpZiggc3ByZWFkIDwgMCApIHJldHVybiBcImZmMDBcIit0b0hleCgyNTUrc3ByZWFkKTtcbiAgZWxzZSBpZiggc3ByZWFkID4gMCApIHJldHVybiB0b0hleCgyNTUtc3ByZWFkKStcIjAwZmZcIjtcbiAgZWxzZSByZXR1cm4gXCJmZmZmMDBcIjtcbn07XG5cbm1vZHVsZS5leHBvcnRzLnRvSGV4ID0gZnVuY3Rpb24obnVtKSB7XG4gIG51bSA9IG51bS50b1N0cmluZygxNik7XG4gIGlmKCBudW0ubGVuZ3RoID09IDEgKSBudW0gPSBcIjBcIitudW07XG4gIHJldHVybiBudW07XG59O1xuIiwiLyoqXG4gIEEgRmVhdHVyZSBzaG91bGQgaGF2ZSB0aGUgZm9sbG93aW5nOlxuXG4gIGZlYXR1cmUgPSB7XG4gICAgdmlzaWJsZSA6IEJvb2xlYW4sXG4gICAgc2l6ZSA6IE51bWJlciwgLy8gcG9pbnRzIG9ubHksIHVzZWQgZm9yIG1vdXNlIGludGVyYWN0aW9uc1xuICAgIGdlb2pzb24gOiB7fVxuICAgIHJlbmRlciA6IGZ1bmN0aW9uKGNvbnRleHQsIGNvb3JkaW5hdGVzSW5YWSwgbWFwKSB7fSAvLyBjYWxsZWQgaW4gZmVhdHVyZSBzY29wZVxuICB9XG5cbiAgZ2VvWFkgYW5kIGxlYWZsZXQgd2lsbCBiZSBhc3NpZ25lZFxuKiovXG5cbkwuQ2FudmFzR2VvanNvbkxheWVyID0gTC5DbGFzcy5leHRlbmQoe1xuICAvLyBzaG93IGxheWVyIHRpbWluZ1xuICBkZWJ1ZyA6IGZhbHNlLFxuXG4gIC8vIGluY2x1ZGUgZXZlbnRzXG4gIGluY2x1ZGVzOiBbTC5NaXhpbi5FdmVudHNdLFxuXG4gIC8vIGxpc3Qgb2YgZ2VvanNvbiBmZWF0dXJlcyB0byBkcmF3XG4gIC8vICAgLSB0aGVzZSB3aWxsIGRyYXcgaW4gb3JkZXJcbiAgZmVhdHVyZXMgOiBbXSxcblxuICAvLyBsaXN0IG9mIGN1cnJlbnQgZmVhdHVyZXMgdW5kZXIgdGhlIG1vdXNlXG4gIGludGVyc2VjdExpc3QgOiBbXSxcblxuICAvLyB1c2VkIHRvIGNhbGN1bGF0ZSBwaXhlbHMgbW92ZWQgZnJvbSBjZW50ZXJcbiAgbGFzdENlbnRlckxMIDogbnVsbCxcblxuICAvLyBnZW9tZXRyeSBoZWxwZXJzXG4gIHV0aWxzIDogcmVxdWlyZSgnLi91dGlscycpLFxuXG4gIC8vIGluaXRpYWxpemUgbGF5ZXJcbiAgaW5pdGlhbGl6ZTogZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAvLyBzZXQgb3B0aW9uc1xuICAgIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuICAgIEwuVXRpbC5zZXRPcHRpb25zKHRoaXMsIG9wdGlvbnMpO1xuXG4gICAgLy8gbW92ZSBtb3VzZSBldmVudCBoYW5kbGVycyB0byBsYXllciBzY29wZVxuICAgIHZhciBtb3VzZUV2ZW50cyA9IFsnb25Nb3VzZU92ZXInLCAnb25Nb3VzZU1vdmUnLCAnb25Nb3VzZU91dCcsICdvbkNsaWNrJ107XG4gICAgbW91c2VFdmVudHMuZm9yRWFjaChmdW5jdGlvbihlKXtcbiAgICAgIGlmKCAhdGhpcy5vcHRpb25zW2VdICkgcmV0dXJuO1xuICAgICAgdGhpc1tlXSA9IHRoaXMub3B0aW9uc1tlXTtcbiAgICAgIGRlbGV0ZSB0aGlzLm9wdGlvbnNbZV07XG4gICAgfS5iaW5kKHRoaXMpKTtcblxuICAgIC8vIHNldCBjYW52YXMgYW5kIGNhbnZhcyBjb250ZXh0IHNob3J0Y3V0c1xuICAgIHRoaXMuX2NhbnZhcyA9IHRoaXMuX2NyZWF0ZUNhbnZhcygpO1xuICAgIHRoaXMuX2N0eCA9IHRoaXMuX2NhbnZhcy5nZXRDb250ZXh0KCcyZCcpO1xuICB9LFxuXG4gIF9jcmVhdGVDYW52YXM6IGZ1bmN0aW9uKCkge1xuICAgIHZhciBjYW52YXMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdjYW52YXMnKTtcbiAgICBjYW52YXMuc3R5bGUucG9zaXRpb24gPSAnYWJzb2x1dGUnO1xuICAgIGNhbnZhcy5zdHlsZS50b3AgPSAwO1xuICAgIGNhbnZhcy5zdHlsZS5sZWZ0ID0gMDtcbiAgICBjYW52YXMuc3R5bGUucG9pbnRlckV2ZW50cyA9IFwibm9uZVwiO1xuICAgIGNhbnZhcy5zdHlsZS56SW5kZXggPSB0aGlzLm9wdGlvbnMuekluZGV4IHx8IDA7XG4gICAgdmFyIGNsYXNzTmFtZSA9ICdsZWFmbGV0LXRpbGUtY29udGFpbmVyIGxlYWZsZXQtem9vbS1hbmltYXRlZCc7XG4gICAgY2FudmFzLnNldEF0dHJpYnV0ZSgnY2xhc3MnLCBjbGFzc05hbWUpO1xuICAgIHJldHVybiBjYW52YXM7XG4gIH0sXG5cbiAgb25BZGQ6IGZ1bmN0aW9uIChtYXApIHtcbiAgICB0aGlzLl9tYXAgPSBtYXA7XG5cbiAgICAvLyBhZGQgY29udGFpbmVyIHdpdGggdGhlIGNhbnZhcyB0byB0aGUgdGlsZSBwYW5lXG4gICAgLy8gdGhlIGNvbnRhaW5lciBpcyBtb3ZlZCBpbiB0aGUgb3Bvc2l0ZSBkaXJlY3Rpb24gb2YgdGhlXG4gICAgLy8gbWFwIHBhbmUgdG8ga2VlcCB0aGUgY2FudmFzIGFsd2F5cyBpbiAoMCwgMClcbiAgICAvL3ZhciB0aWxlUGFuZSA9IHRoaXMuX21hcC5fcGFuZXMudGlsZVBhbmU7XG4gICAgdmFyIHRpbGVQYW5lID0gdGhpcy5fbWFwLl9wYW5lcy5tYXJrZXJQYW5lO1xuICAgIHZhciBfY29udGFpbmVyID0gTC5Eb21VdGlsLmNyZWF0ZSgnZGl2JywgJ2xlYWZsZXQtbGF5ZXInKTtcblxuICAgIF9jb250YWluZXIuYXBwZW5kQ2hpbGQodGhpcy5fY2FudmFzKTtcbiAgICB0aWxlUGFuZS5hcHBlbmRDaGlsZChfY29udGFpbmVyKTtcblxuICAgIHRoaXMuX2NvbnRhaW5lciA9IF9jb250YWluZXI7XG5cbiAgICAvLyBoYWNrOiBsaXN0ZW4gdG8gcHJlZHJhZyBldmVudCBsYXVuY2hlZCBieSBkcmFnZ2luZyB0b1xuICAgIC8vIHNldCBjb250YWluZXIgaW4gcG9zaXRpb24gKDAsIDApIGluIHNjcmVlbiBjb29yZGluYXRlc1xuICAgIGlmIChtYXAuZHJhZ2dpbmcuZW5hYmxlZCgpKSB7XG4gICAgICBtYXAuZHJhZ2dpbmcuX2RyYWdnYWJsZS5vbigncHJlZHJhZycsIGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgZCA9IG1hcC5kcmFnZ2luZy5fZHJhZ2dhYmxlO1xuICAgICAgICBMLkRvbVV0aWwuc2V0UG9zaXRpb24odGhpcy5fY2FudmFzLCB7IHg6IC1kLl9uZXdQb3MueCwgeTogLWQuX25ld1Bvcy55IH0pO1xuICAgICAgfSwgdGhpcyk7XG4gICAgfVxuXG4gICAgbWFwLm9uKHtcbiAgICAgICd2aWV3cmVzZXQnIDogdGhpcy5fcmVzZXQsXG4gICAgICAncmVzaXplJyAgICA6IHRoaXMuX3Jlc2V0LFxuICAgICAgJ21vdmUnICAgICAgOiB0aGlzLnJlbmRlcixcbiAgICAgICd6b29tc3RhcnQnIDogdGhpcy5fc3RhcnRab29tLFxuICAgICAgJ3pvb21lbmQnICAgOiB0aGlzLl9lbmRab29tLFxuICAgICAgJ21vdXNlbW92ZScgOiB0aGlzLl9pbnRlcnNlY3RzLFxuICAgICAgJ2NsaWNrJyAgICAgOiB0aGlzLl9pbnRlcnNlY3RzXG4gICAgfSwgdGhpcyk7XG5cbiAgICB0aGlzLl9yZXNldCgpO1xuXG4gICAgaWYoIHRoaXMuekluZGV4ICE9PSB1bmRlZmluZWQgKSB7XG4gICAgICB0aGlzLnNldFpJbmRleCh0aGlzLnpJbmRleCk7XG4gICAgfVxuICB9LFxuXG4gIHNldFpJbmRleCA6IGZ1bmN0aW9uKGluZGV4KSB7XG4gICAgdGhpcy56SW5kZXggPSBpbmRleDtcbiAgICBpZiggdGhpcy5fY29udGFpbmVyICkge1xuICAgICAgdGhpcy5fY29udGFpbmVyLnN0eWxlLnpJbmRleCA9IGluZGV4O1xuICAgIH1cbiAgfSxcblxuICBfc3RhcnRab29tOiBmdW5jdGlvbigpIHtcbiAgICB0aGlzLl9jYW52YXMuc3R5bGUudmlzaWJpbGl0eSA9ICdoaWRkZW4nO1xuICAgIHRoaXMuem9vbWluZyA9IHRydWU7XG4gIH0sXG5cbiAgX2VuZFpvb206IGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLl9jYW52YXMuc3R5bGUudmlzaWJpbGl0eSA9ICd2aXNpYmxlJztcbiAgICB0aGlzLnpvb21pbmcgPSBmYWxzZTtcbiAgICBzZXRUaW1lb3V0KHRoaXMucmVuZGVyLmJpbmQodGhpcyksIDUwKTtcbiAgfSxcblxuICBnZXRDYW52YXM6IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLl9jYW52YXM7XG4gIH0sXG5cbiAgZHJhdzogZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5fcmVzZXQoKTtcbiAgfSxcblxuICBvblJlbW92ZTogZnVuY3Rpb24gKG1hcCkge1xuICAgIHRoaXMuX2NvbnRhaW5lci5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKHRoaXMuX2NvbnRhaW5lcik7XG4gICAgbWFwLm9mZih7XG4gICAgICAndmlld3Jlc2V0JyA6IHRoaXMuX3Jlc2V0LFxuICAgICAgJ3Jlc2l6ZScgICAgOiB0aGlzLl9yZXNldCxcbiAgICAgICdtb3ZlJyAgICAgIDogdGhpcy5yZW5kZXIsXG4gICAgICAnem9vbXN0YXJ0JyA6IHRoaXMuX3N0YXJ0Wm9vbSxcbiAgICAgICd6b29tZW5kJyAgIDogdGhpcy5fZW5kWm9vbSxcbiAgICAgICdtb3VzZW1vdmUnIDogdGhpcy5faW50ZXJzZWN0cyxcbiAgICAgICdjbGljaycgICAgIDogdGhpcy5faW50ZXJzZWN0c1xuICAgIH0sIHRoaXMpO1xuICB9LFxuXG4gIGFkZFRvOiBmdW5jdGlvbiAobWFwKSB7XG4gICAgbWFwLmFkZExheWVyKHRoaXMpO1xuICAgIHJldHVybiB0aGlzO1xuICB9LFxuXG4gIF9yZXNldDogZnVuY3Rpb24gKCkge1xuICAgIC8vIHJlc2V0IGFjdHVhbCBjYW52YXMgc2l6ZVxuICAgIHZhciBzaXplID0gdGhpcy5fbWFwLmdldFNpemUoKTtcbiAgICB0aGlzLl9jYW52YXMud2lkdGggPSBzaXplLng7XG4gICAgdGhpcy5fY2FudmFzLmhlaWdodCA9IHNpemUueTtcblxuICAgIHRoaXMuY2xlYXJDYWNoZSgpO1xuXG4gICAgdGhpcy5yZW5kZXIoKTtcbiAgfSxcblxuICAvLyBjbGVhciBlYWNoIGZlYXR1cmVzIGNhY2hlXG4gIGNsZWFyQ2FjaGUgOiBmdW5jdGlvbigpIHtcbiAgICAvLyBraWxsIHRoZSBmZWF0dXJlIHBvaW50IGNhY2hlXG4gICAgZm9yKCB2YXIgaSA9IDA7IGkgPCB0aGlzLmZlYXR1cmVzLmxlbmd0aDsgaSsrICkge1xuICAgICAgdGhpcy5jbGVhckZlYXR1cmVDYWNoZSggdGhpcy5mZWF0dXJlc1tpXSApO1xuICAgIH1cbiAgfSxcblxuICBjbGVhckZlYXR1cmVDYWNoZSA6IGZ1bmN0aW9uKGZlYXR1cmUpIHtcbiAgICBpZiggIWZlYXR1cmUuY2FjaGUgKSByZXR1cm47XG4gICAgZmVhdHVyZS5jYWNoZS5nZW9YWSA9IG51bGw7XG4gIH0sXG5cbiAgLy8gcmVkcmF3IGFsbCBmZWF0dXJlcy4gIFRoaXMgZG9lcyBub3QgaGFuZGxlIGNsZWFyaW5nIHRoZSBjYW52YXMgb3Igc2V0dGluZ1xuICAvLyB0aGUgY2FudmFzIGNvcnJlY3QgcG9zaXRpb24uICBUaGF0IGlzIGhhbmRsZWQgYnkgcmVuZGVyXG4gIHJlZHJhdzogZnVuY3Rpb24oZGlmZikge1xuICAgIC8vIG9iamVjdHMgc2hvdWxkIGtlZXAgdHJhY2sgb2YgbGFzdCBiYm94IGFuZCB6b29tIG9mIG1hcFxuICAgIC8vIGlmIHRoaXMgaGFzbid0IGNoYW5nZWQgdGhlIGxsIC0+IGNvbnRhaW5lciBwdCBpcyBub3QgbmVlZGVkXG4gICAgdmFyIGJvdW5kcyA9IHRoaXMuX21hcC5nZXRCb3VuZHMoKTtcbiAgICB2YXIgem9vbSA9IHRoaXMuX21hcC5nZXRab29tKCk7XG5cbiAgICBpZiggdGhpcy5kZWJ1ZyApIHQgPSBuZXcgRGF0ZSgpLmdldFRpbWUoKTtcblxuICAgIGZvciggdmFyIGkgPSAwOyBpIDwgdGhpcy5mZWF0dXJlcy5sZW5ndGg7IGkrKyApIHtcbiAgICAgIHRoaXMucmVkcmF3RmVhdHVyZSh0aGlzLmZlYXR1cmVzW2ldLCBib3VuZHMsIHpvb20sIGRpZmYpO1xuICAgIH1cblxuICAgIGlmKCB0aGlzLmRlYnVnICkgY29uc29sZS5sb2coJ1JlbmRlciB0aW1lOiAnKyhuZXcgRGF0ZSgpLmdldFRpbWUoKSAtIHQpKydtczsgYXZnOiAnK1xuICAgICAgKChuZXcgRGF0ZSgpLmdldFRpbWUoKSAtIHQpIC8gdGhpcy5mZWF0dXJlcy5sZW5ndGgpKydtcycpO1xuICB9LFxuXG4gIC8vIHJlZHJhdyBhbiBpbmRpdmlkdWFsIGZlYXR1cmVcbiAgcmVkcmF3RmVhdHVyZSA6IGZ1bmN0aW9uKGZlYXR1cmUsIGJvdW5kcywgem9vbSwgZGlmZikge1xuICAgIC8vaWYoIGZlYXR1cmUuZ2VvanNvbi5wcm9wZXJ0aWVzLmRlYnVnICkgZGVidWdnZXI7XG5cbiAgICAvLyBpZ25vcmUgYW55dGhpbmcgZmxhZ2dlZCBhcyBoaWRkZW5cbiAgICAvLyB3ZSBkbyBuZWVkIHRvIGNsZWFyIHRoZSBjYWNoZSBpbiB0aGlzIGNhc2VcbiAgICBpZiggIWZlYXR1cmUudmlzaWJsZSApIHtcbiAgICAgIHRoaXMuY2xlYXJGZWF0dXJlQ2FjaGUoZmVhdHVyZSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gbm93IGxldHMgY2hlY2sgY2FjaGUgdG8gc2VlIGlmIHdlIG5lZWQgdG8gcmVwcm9qZWN0IHRoZVxuICAgIC8vIHh5IGNvb3JkaW5hdGVzXG4gICAgdmFyIHJlcHJvamVjdCA9IHRydWU7XG4gICAgaWYoIGZlYXR1cmUuY2FjaGUgKSB7XG4gICAgICBpZiggZmVhdHVyZS5jYWNoZS56b29tID09IHpvb20gJiYgZmVhdHVyZS5jYWNoZS5nZW9YWSApIHtcbiAgICAgICAgcmVwcm9qZWN0ID0gZmFsc2U7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gYWN0dWFsbHkgcHJvamVjdCB0byB4eSBpZiBuZWVkZWRcbiAgICBpZiggcmVwcm9qZWN0ICkge1xuICAgICAgdGhpcy5fY2FsY0dlb1hZKGZlYXR1cmUsIHpvb20pO1xuICAgIH0gIC8vIGVuZCByZXByb2plY3RcblxuICAgIC8vIGlmIHRoaXMgd2FzIGEgc2ltcGxlIHBhbiBldmVudCAoYSBkaWZmIHdhcyBwcm92aWRlZCkgYW5kIHdlIGRpZCBub3QgcmVwcm9qZWN0XG4gICAgLy8gbW92ZSB0aGUgZmVhdHVyZSBieSBkaWZmIHgveVxuICAgIGlmKCBkaWZmICYmICFyZXByb2plY3QgKSB7XG4gICAgICBpZiggZmVhdHVyZS5nZW9qc29uLmdlb21ldHJ5LnR5cGUgPT0gJ1BvaW50JyApIHtcblxuICAgICAgICBmZWF0dXJlLmNhY2hlLmdlb1hZLnggKz0gZGlmZi54O1xuICAgICAgICBmZWF0dXJlLmNhY2hlLmdlb1hZLnkgKz0gZGlmZi55O1xuXG4gICAgICB9IGVsc2UgaWYoIGZlYXR1cmUuZ2VvanNvbi5nZW9tZXRyeS50eXBlID09ICdMaW5lU3RyaW5nJyApIHtcblxuICAgICAgICB0aGlzLnV0aWxzLm1vdmVMaW5lKGZlYXR1cmUuY2FjaGUuZ2VvWFksIGRpZmYpO1xuXG4gICAgICB9IGVsc2UgaWYgKCBmZWF0dXJlLmdlb2pzb24uZ2VvbWV0cnkudHlwZSA9PSAnUG9seWdvbicgKSB7XG4gICAgICAgIHRoaXMudXRpbHMubW92ZUxpbmUoZmVhdHVyZS5jYWNoZS5nZW9YWSwgZGlmZik7XG4gICAgICB9IGVsc2UgaWYgKCBmZWF0dXJlLmdlb2pzb24uZ2VvbWV0cnkudHlwZSA9PSAnTXVsdGlQb2x5Z29uJyApIHtcbiAgICAgICAgZm9yKCB2YXIgaSA9IDA7IGkgPCBmZWF0dXJlLmNhY2hlLmdlb1hZLmxlbmd0aDsgaSsrICkge1xuICAgICAgICAgIHRoaXMudXRpbHMubW92ZUxpbmUoZmVhdHVyZS5jYWNoZS5nZW9YWVtpXSwgZGlmZik7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBpZ25vcmUgYW55dGhpbmcgbm90IGluIGJvdW5kc1xuICAgIGlmKCBmZWF0dXJlLmdlb2pzb24uZ2VvbWV0cnkudHlwZSA9PSAnUG9pbnQnICkge1xuICAgICAgaWYoICFib3VuZHMuY29udGFpbnMoZmVhdHVyZS5sYXRsbmcpICkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgfSBlbHNlIGlmKCBmZWF0dXJlLmdlb2pzb24uZ2VvbWV0cnkudHlwZSA9PSAnTXVsdGlQb2x5Z29uJyApIHtcblxuICAgICAgLy8ganVzdCBtYWtlIHN1cmUgYXQgbGVhc3Qgb25lIHBvbHlnb24gaXMgd2l0aGluIHJhbmdlXG4gICAgICB2YXIgZm91bmQgPSBmYWxzZTtcbiAgICAgIGZvciggdmFyIGkgPSAwOyBpIDwgZmVhdHVyZS5ib3VuZHMubGVuZ3RoOyBpKysgKSB7XG4gICAgICAgIGlmKCBib3VuZHMuY29udGFpbnMoZmVhdHVyZS5ib3VuZHNbaV0pIHx8IGJvdW5kcy5pbnRlcnNlY3RzKGZlYXR1cmUuYm91bmRzW2ldKSApIHtcbiAgICAgICAgICBmb3VuZCA9IHRydWU7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmKCAhZm91bmQgKSByZXR1cm47XG5cbiAgICB9IGVsc2Uge1xuICAgICAgaWYoICFib3VuZHMuY29udGFpbnMoZmVhdHVyZS5ib3VuZHMpICYmICFib3VuZHMuaW50ZXJzZWN0cyhmZWF0dXJlLmJvdW5kcykgKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBjYWxsIGZlYXR1cmUgcmVuZGVyIGZ1bmN0aW9uIGluIGZlYXR1cmUgc2NvcGU7IGZlYXR1cmUgaXMgcGFzc2VkIGFzIHdlbGxcbiAgICBmZWF0dXJlLnJlbmRlci5jYWxsKGZlYXR1cmUsIHRoaXMuX2N0eCwgZmVhdHVyZS5jYWNoZS5nZW9YWSwgdGhpcy5fbWFwLCBmZWF0dXJlKTtcbiAgfSxcblxuICBfY2FsY0dlb1hZIDogZnVuY3Rpb24oZmVhdHVyZSwgem9vbSkge1xuICAgIC8vIG1ha2Ugc3VyZSB3ZSBoYXZlIGEgY2FjaGUgbmFtZXNwYWNlIGFuZCBzZXQgdGhlIHpvb20gbGV2ZWxcbiAgICBpZiggIWZlYXR1cmUuY2FjaGUgKSBmZWF0dXJlLmNhY2hlID0ge307XG4gICAgZmVhdHVyZS5jYWNoZS56b29tID0gem9vbTtcblxuICAgIGlmKCBmZWF0dXJlLmdlb2pzb24uZ2VvbWV0cnkudHlwZSA9PSAnUG9pbnQnICkge1xuXG4gICAgICBmZWF0dXJlLmNhY2hlLmdlb1hZID0gdGhpcy5fbWFwLmxhdExuZ1RvQ29udGFpbmVyUG9pbnQoW1xuICAgICAgICAgIGZlYXR1cmUuZ2VvanNvbi5nZW9tZXRyeS5jb29yZGluYXRlc1sxXSxcbiAgICAgICAgICBmZWF0dXJlLmdlb2pzb24uZ2VvbWV0cnkuY29vcmRpbmF0ZXNbMF1cbiAgICAgIF0pO1xuXG4gICAgICBpZiggZmVhdHVyZS5zaXplICkge1xuICAgICAgICBmZWF0dXJlLmNhY2hlLmdlb1hZWzBdID0gZmVhdHVyZS5jYWNoZS5nZW9YWVswXSAtIGZlYXR1cmUuc2l6ZSAvIDI7XG4gICAgICAgIGZlYXR1cmUuY2FjaGUuZ2VvWFlbMV0gPSBmZWF0dXJlLmNhY2hlLmdlb1hZWzFdIC0gZmVhdHVyZS5zaXplIC8gMjtcbiAgICAgIH1cblxuICAgIH0gZWxzZSBpZiggZmVhdHVyZS5nZW9qc29uLmdlb21ldHJ5LnR5cGUgPT0gJ0xpbmVTdHJpbmcnICkge1xuICAgICAgZmVhdHVyZS5jYWNoZS5nZW9YWSA9IHRoaXMudXRpbHMucHJvamVjdExpbmUoZmVhdHVyZS5nZW9qc29uLmdlb21ldHJ5LmNvb3JkaW5hdGVzLCB0aGlzLl9tYXApO1xuXG4gICAgfSBlbHNlIGlmICggZmVhdHVyZS5nZW9qc29uLmdlb21ldHJ5LnR5cGUgPT0gJ1BvbHlnb24nICkge1xuICAgICAgZmVhdHVyZS5jYWNoZS5nZW9YWSA9IHRoaXMudXRpbHMucHJvamVjdExpbmUoZmVhdHVyZS5nZW9qc29uLmdlb21ldHJ5LmNvb3JkaW5hdGVzWzBdLCB0aGlzLl9tYXApO1xuICAgIH0gZWxzZSBpZiAoIGZlYXR1cmUuZ2VvanNvbi5nZW9tZXRyeS50eXBlID09ICdNdWx0aVBvbHlnb24nICkge1xuICAgICAgZmVhdHVyZS5jYWNoZS5nZW9YWSA9IFtdO1xuICAgICAgZm9yKCB2YXIgaSA9IDA7IGkgPCBmZWF0dXJlLmdlb2pzb24uZ2VvbWV0cnkuY29vcmRpbmF0ZXMubGVuZ3RoOyBpKysgKSB7XG4gICAgICAgIGZlYXR1cmUuY2FjaGUuZ2VvWFkucHVzaCh0aGlzLnV0aWxzLnByb2plY3RMaW5lKGZlYXR1cmUuZ2VvanNvbi5nZW9tZXRyeS5jb29yZGluYXRlc1tpXVswXSwgdGhpcy5fbWFwKSk7XG4gICAgICB9XG4gICAgfVxuXG4gIH0sXG5cbiAgYWRkRmVhdHVyZXMgOiBmdW5jdGlvbihmZWF0dXJlcykge1xuICAgIGZvciggdmFyIGkgPSAwOyBpIDwgdGhpcy5mZWF0dXJlcy5sZW5ndGg7IGkrKyApIHtcbiAgICAgIHRoaXMuYWRkRmVhdHVyZSh0aGlzLmZlYXR1cmVzW2ldKTtcbiAgICB9XG4gIH0sXG5cbiAgYWRkRmVhdHVyZSA6IGZ1bmN0aW9uKGZlYXR1cmUsIGJvdHRvbSkge1xuICAgIGlmKCAhZmVhdHVyZS5nZW9qc29uICkgcmV0dXJuO1xuICAgIGlmKCAhZmVhdHVyZS5nZW9qc29uLmdlb21ldHJ5ICkgcmV0dXJuO1xuXG4gICAgaWYoIHR5cGVvZiBmZWF0dXJlLnZpc2libGUgPT09ICd1bmRlZmluZWQnICkgZmVhdHVyZS52aXNpYmxlID0gdHJ1ZTtcbiAgICBmZWF0dXJlLmNhY2hlID0gbnVsbDtcblxuICAgIGlmKCBmZWF0dXJlLmdlb2pzb24uZ2VvbWV0cnkudHlwZSA9PSAnTGluZVN0cmluZycgKSB7XG4gICAgICBmZWF0dXJlLmJvdW5kcyA9IHRoaXMudXRpbHMuY2FsY0JvdW5kcyhmZWF0dXJlLmdlb2pzb24uZ2VvbWV0cnkuY29vcmRpbmF0ZXMpO1xuXG4gICAgfSBlbHNlIGlmICggZmVhdHVyZS5nZW9qc29uLmdlb21ldHJ5LnR5cGUgPT0gJ1BvbHlnb24nICkge1xuICAgICAgLy8gVE9ETzogd2Ugb25seSBzdXBwb3J0IG91dGVyIHJpbmdzIG91dCB0aGUgbW9tZW50LCBubyBpbm5lciByaW5ncy4gIFRodXMgY29vcmRpbmF0ZXNbMF1cbiAgICAgIGZlYXR1cmUuYm91bmRzID0gdGhpcy51dGlscy5jYWxjQm91bmRzKGZlYXR1cmUuZ2VvanNvbi5nZW9tZXRyeS5jb29yZGluYXRlc1swXSk7XG5cbiAgICB9IGVsc2UgaWYgKCBmZWF0dXJlLmdlb2pzb24uZ2VvbWV0cnkudHlwZSA9PSAnUG9pbnQnICkge1xuICAgICAgZmVhdHVyZS5sYXRsbmcgPSBMLmxhdExuZyhmZWF0dXJlLmdlb2pzb24uZ2VvbWV0cnkuY29vcmRpbmF0ZXNbMV0sIGZlYXR1cmUuZ2VvanNvbi5nZW9tZXRyeS5jb29yZGluYXRlc1swXSk7XG4gICAgfSBlbHNlIGlmICggZmVhdHVyZS5nZW9qc29uLmdlb21ldHJ5LnR5cGUgPT0gJ011bHRpUG9seWdvbicgKSB7XG4gICAgICBmZWF0dXJlLmJvdW5kcyA9IFtdO1xuICAgICAgZm9yKCB2YXIgaSA9IDA7IGkgPCBmZWF0dXJlLmdlb2pzb24uZ2VvbWV0cnkuY29vcmRpbmF0ZXMubGVuZ3RoOyBpKysgICkge1xuICAgICAgICBmZWF0dXJlLmJvdW5kcy5wdXNoKHRoaXMudXRpbHMuY2FsY0JvdW5kcyhmZWF0dXJlLmdlb2pzb24uZ2VvbWV0cnkuY29vcmRpbmF0ZXNbaV1bMF0pKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgY29uc29sZS5sb2coJ0dlb0pTT04gZmVhdHVyZSB0eXBlIFwiJytmZWF0dXJlLmdlb2pzb24uZ2VvbWV0cnkudHlwZSsnXCIgbm90IHN1cHBvcnRlZC4nKTtcbiAgICAgIGNvbnNvbGUubG9nKGZlYXR1cmUuZ2VvanNvbik7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYoIGJvdHRvbSApIHsgLy8gYm90dG9tIG9yIGluZGV4XG4gICAgICBpZiggdHlwZW9mIGJvdHRvbSA9PT0gJ251bWJlcicpIHRoaXMuZmVhdHVyZXMuc3BsaWNlKGJvdHRvbSwgMCwgZmVhdHVyZSk7XG4gICAgICBlbHNlIHRoaXMuZmVhdHVyZXMudW5zaGlmdChmZWF0dXJlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5mZWF0dXJlcy5wdXNoKGZlYXR1cmUpO1xuICAgIH1cbiAgfSxcblxuICBhZGRGZWF0dXJlQm90dG9tIDogZnVuY3Rpb24oZmVhdHVyZSkge1xuICAgIHRoaXMuYWRkRmVhdHVyZShmZWF0dXJlLCB0cnVlKTtcbiAgfSxcblxuICAvLyByZXR1cm5zIHRydWUgaWYgcmUtcmVuZGVyIHJlcXVpcmVkLiAgaWUgdGhlIGZlYXR1cmUgd2FzIHZpc2libGU7XG4gIHJlbW92ZUZlYXR1cmUgOiBmdW5jdGlvbihmZWF0dXJlKSB7XG4gICAgdmFyIGluZGV4ID0gdGhpcy5mZWF0dXJlcy5pbmRleE9mKGZlYXR1cmUpO1xuICAgIGlmKCBpbmRleCA9PSAtMSApIHJldHVybjtcblxuICAgIHRoaXMuc3BsaWNlKGluZGV4LCAxKTtcblxuICAgIGlmKCB0aGlzLmZlYXR1cmUudmlzaWJsZSApIHJldHVybiB0cnVlO1xuICAgIHJldHVybiBmYWxzZTtcbiAgfSxcblxuICAvLyBnZXQgbGF5ZXIgZmVhdHVyZSB2aWEgZ2VvanNvbiBvYmplY3RcbiAgZ2V0RmVhdHVyZUZvckdlb2pzb24gOiBmdW5jdGlvbihnZW9qc29uKSB7XG4gICAgZm9yKCB2YXIgaSA9IDA7IGkgPCB0aGlzLmZlYXR1cmVzLmxlbmd0aDsgaSsrICkge1xuICAgICAgaWYoIHRoaXMuZmVhdHVyZXNbaV0uZ2VvanNvbiA9PSBnZW9qc29uICkgcmV0dXJuIHRoaXMuZmVhdHVyZXNbaV07XG4gICAgfVxuXG4gICAgcmV0dXJuIG51bGw7XG4gIH0sXG5cbiAgcmVuZGVyOiBmdW5jdGlvbihlKSB7XG4gICAgdmFyIHQsIGRpZmZcbiAgICBpZiggdGhpcy5kZWJ1ZyApIHQgPSBuZXcgRGF0ZSgpLmdldFRpbWUoKTtcblxuICAgIHZhciBkaWZmID0gbnVsbDtcbiAgICBpZiggZSAmJiBlLnR5cGUgPT0gJ21vdmUnICkge1xuICAgICAgdmFyIGNlbnRlciA9IHRoaXMuX21hcC5nZXRDZW50ZXIoKTtcblxuICAgICAgdmFyIHB0ID0gdGhpcy5fbWFwLmxhdExuZ1RvQ29udGFpbmVyUG9pbnQoY2VudGVyKTtcbiAgICAgIGlmKCB0aGlzLmxhc3RDZW50ZXJMTCApIHtcbiAgICAgICAgdmFyIGxhc3RYeSA9IHRoaXMuX21hcC5sYXRMbmdUb0NvbnRhaW5lclBvaW50KHRoaXMubGFzdENlbnRlckxMKTtcbiAgICAgICAgZGlmZiA9IHtcbiAgICAgICAgICB4IDogbGFzdFh5LnggLSBwdC54LFxuICAgICAgICAgIHkgOiBsYXN0WHkueSAtIHB0LnlcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICB0aGlzLmxhc3RDZW50ZXJMTCA9IGNlbnRlcjtcbiAgICB9XG5cbiAgICB2YXIgdG9wTGVmdCA9IHRoaXMuX21hcC5jb250YWluZXJQb2ludFRvTGF5ZXJQb2ludChbMCwgMF0pO1xuICAgIEwuRG9tVXRpbC5zZXRQb3NpdGlvbih0aGlzLl9jYW52YXMsIHRvcExlZnQpO1xuXG4gICAgdmFyIGNhbnZhcyA9IHRoaXMuZ2V0Q2FudmFzKCk7XG4gICAgdmFyIGN0eCA9IGNhbnZhcy5nZXRDb250ZXh0KCcyZCcpO1xuXG4gICAgLy8gY2xlYXIgY2FudmFzXG4gICAgY3R4LmNsZWFyUmVjdCgwLCAwLCBjYW52YXMud2lkdGgsIGNhbnZhcy5oZWlnaHQpO1xuXG4gICAgaWYoICF0aGlzLnpvb21pbmcgKSB0aGlzLnJlZHJhdyhkaWZmKTtcblxuICAgIGlmKCB0aGlzLmRlYnVnICkge1xuICAgICAgZGlmZiA9IG5ldyBEYXRlKCkuZ2V0VGltZSgpIC0gdDtcblxuICAgICAgdmFyIGMgPSAwO1xuICAgICAgZm9yKCB2YXIgaSA9IDA7IGkgPCB0aGlzLmZlYXR1cmVzLmxlbmd0aDsgaSsrICkge1xuICAgICAgICBpZiggIXRoaXMuZmVhdHVyZXNbaV0uY2FjaGUuZ2VvWFkgKSBjb250aW51ZTtcbiAgICAgICAgaWYoIEFycmF5LmlzQXJyYXkodGhpcy5mZWF0dXJlc1tpXS5jYWNoZS5nZW9YWSkgKSBjICs9IHRoaXMuZmVhdHVyZXNbaV0uY2FjaGUuZ2VvWFkubGVuZ3RoO1xuICAgICAgfVxuXG4gICAgICBjb25zb2xlLmxvZygnUmVuZGVyZWQgJytjKycgcHRzIGluICcrZGlmZisnbXMnKTtcbiAgICB9XG4gIH0sXG5cbiAgLypcbiAgICByZXR1cm4gbGlzdCBvZiBhbGwgaW50ZXJzZWN0aW5nIGdlb21ldHJ5IHJlZ3JhZGxlc3MgaXMgY3VycmVudGx5IHZpc2libGVcblxuICAgIHB4UmFkaXVzIC0gaXMgZm9yIGxpbmVzIGFuZCBwb2ludHMgb25seS4gIEJhc2ljYWxseSBob3cgZmFyIG9mZiB0aGUgbGluZSBvclxuICAgIG9yIHBvaW50IGEgbGF0bG5nIGNhbiBiZSBhbmQgc3RpbGwgYmUgY29uc2lkZXJlZCBpbnRlcnNlY3RpbmcuICBUaGlzIGlzXG4gICAgZ2l2ZW4gaW4gcHggYXMgaXQgaXMgY29tcGVuc2F0aW5nIGZvciB1c2VyIGludGVudCB3aXRoIG1vdXNlIGNsaWNrIG9yIHRvdWNoLlxuICAgIFRoZSBwb2ludCBtdXN0IGxheSBpbnNpZGUgdG8gcG9seWdvbiBmb3IgYSBtYXRjaC5cbiAgKi9cbiAgZ2V0QWxsSW50ZXJzZWN0aW5nR2VvbWV0cnkgOiBmdW5jdGlvbihsYXRsbmcsIHB4UmFkaXVzKSB7XG4gICAgdmFyIG1wcCA9IHRoaXMudXRpbHMubWV0ZXJzUGVyUHgobGF0bG5nLCB0aGlzLl9tYXApO1xuICAgIHZhciByID0gbXBwICogKHB4UmFkaXVzIHx8IDUpOyAvLyA1IHB4IHJhZGl1cyBidWZmZXI7XG5cbiAgICB2YXIgY2VudGVyID0ge1xuICAgICAgdHlwZSA6ICdQb2ludCcsXG4gICAgICBjb29yZGluYXRlcyA6IFtsYXRsbmcubG5nLCBsYXRsbmcubGF0XVxuICAgIH07XG4gICAgdmFyIHpvb20gPSB0aGlzLl9tYXAuZ2V0Wm9vbSgpO1xuICAgIHZhciBjb250YWluZXJQb2ludCA9IHRoaXMuX21hcC5sYXRMbmdUb0NvbnRhaW5lclBvaW50KGxhdGxuZyk7XG5cbiAgICB2YXIgZjtcbiAgICB2YXIgaW50ZXJzZWN0cyA9IFtdO1xuXG4gICAgZm9yKCB2YXIgaSA9IDA7IGkgPCB0aGlzLmZlYXR1cmVzLmxlbmd0aDsgaSsrICkge1xuICAgICAgZiA9IHRoaXMuZmVhdHVyZXNbaV07XG5cbiAgICAgIGlmKCAhZi5nZW9qc29uLmdlb21ldHJ5ICkgY29udGludWU7XG5cbiAgICAgIC8vIGNoZWNrIHRoZSBib3VuZGluZyBib3ggZm9yIGludGVyc2VjdGlvbiBmaXJzdFxuICAgICAgaWYoICF0aGlzLl9pc0luQm91bmRzKGZlYXR1cmUsIGxhdGxuZykgKSBjb250aW51ZTtcblxuICAgICAgLy8gc2VlIGlmIHdlIG5lZWQgdG8gcmVjYWxjIHRoZSB4LHkgc2NyZWVuIGNvb3JkaW5hdGUgY2FjaGVcbiAgICAgIGlmKCAhZi5jYWNoZSApIHRoaXMuX2NhbGNHZW9YWShmLCB6b29tKTtcbiAgICAgIGVsc2UgaWYoICFmLmNhY2hlLmdlb1hZICkgdGhpcy5fY2FsY0dlb1hZKGYsIHpvb20pO1xuXG4gICAgICBpZiggdGhpcy51dGlscy5nZW9tZXRyeVdpdGhpblJhZGl1cyhmLmdlb2pzb24uZ2VvbWV0cnksIGYuY2FjaGUuZ2VvWFksIGNlbnRlciwgY29udGFpbmVyUG9pbnQsIHIpICkge1xuICAgICAgICBpbnRlcnNlY3RzLnB1c2goZik7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGludGVyc2VjdHM7XG4gIH0sXG5cbiAgLy8gcmV0dXJucyB0cnVlIGlmIGluIGJvdW5kcyBvciB1bmtub3duXG4gIF9pc0luQm91bmRzIDogZnVuY3Rpb24oZmVhdHVyZSwgbGF0bG5nKSB7XG4gICAgaWYoIGZlYXR1cmUuYm91bmRzICkge1xuICAgICAgaWYoIEFycmF5LmlzQXJyYXkoZmVhdHVyZS5ib3VuZHMpICkge1xuXG4gICAgICAgIGZvciggdmFyIGkgPSAwOyBpIDwgZmVhdHVyZS5ib3VuZHMubGVuZ3RoOyBpKysgKSB7XG4gICAgICAgICAgaWYoIGZlYXR1cmUuYm91bmRzW2ldLmNvbnRhaW5zKGxhdGxuZykgKSByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuXG4gICAgICB9IGVsc2UgaWYgKCBmZWF0dXJlLmJvdW5kcy5jb250YWlucyhsYXRsbmcpICkge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfSxcblxuICAvLyBnZXQgdGhlIG1ldGVycyBwZXIgcHggYW5kIGEgY2VydGFpbiBwb2ludDtcbiAgZ2V0TWV0ZXJzUGVyUHggOiBmdW5jdGlvbihsYXRsbmcpIHtcbiAgICByZXR1cm4gdGhpcy51dGlscy5tZXRlcnNQZXJQeChsYXRsbmcsIHRoaXMuX21hcCk7XG4gIH0sXG5cbiAgX2ludGVyc2VjdHMgOiBmdW5jdGlvbihlKSB7XG4gICAgdmFyIHQgPSBuZXcgRGF0ZSgpLmdldFRpbWUoKTtcbiAgICB2YXIgbXBwID0gdGhpcy5nZXRNZXRlcnNQZXJQeChlLmxhdGxuZyk7XG4gICAgdmFyIHIgPSBtcHAgKiA1OyAvLyA1IHB4IHJhZGl1cyBidWZmZXI7XG5cbiAgICB2YXIgY2VudGVyID0ge1xuICAgICAgdHlwZSA6ICdQb2ludCcsXG4gICAgICBjb29yZGluYXRlcyA6IFtlLmxhdGxuZy5sbmcsIGUubGF0bG5nLmxhdF1cbiAgICB9O1xuXG4gICAgdmFyIGY7XG4gICAgdmFyIGludGVyc2VjdHMgPSBbXTtcblxuICAgIGZvciggdmFyIGkgPSAwOyBpIDwgdGhpcy5mZWF0dXJlcy5sZW5ndGg7IGkrKyApIHtcbiAgICAgIGYgPSB0aGlzLmZlYXR1cmVzW2ldO1xuXG4gICAgICBpZiggIWYudmlzaWJsZSApIGNvbnRpbnVlO1xuICAgICAgaWYoICFmLmdlb2pzb24uZ2VvbWV0cnkgKSBjb250aW51ZTtcbiAgICAgIGlmKCAhZi5jYWNoZSApIGNvbnRpbnVlO1xuICAgICAgaWYoICFmLmNhY2hlLmdlb1hZICkgY29udGludWU7XG4gICAgICBpZiggIXRoaXMuX2lzSW5Cb3VuZHMoZiwgZS5sYXRsbmcpICkgY29udGludWU7XG5cbiAgICAgIGlmKCB0aGlzLnV0aWxzLmdlb21ldHJ5V2l0aGluUmFkaXVzKGYuZ2VvanNvbi5nZW9tZXRyeSwgZi5jYWNoZS5nZW9YWSwgY2VudGVyLCBlLmNvbnRhaW5lclBvaW50LCBmLnNpemUgPyAoZi5zaXplICogbXBwKSA6IHIpICkge1xuICAgICAgICBpbnRlcnNlY3RzLnB1c2goZi5nZW9qc29uKTtcbiAgICAgIH1cblxuICAgIH1cblxuICAgIGlmKCBlLnR5cGUgPT0gJ2NsaWNrJyAmJiB0aGlzLm9uQ2xpY2sgKSB7XG4gICAgICB0aGlzLm9uQ2xpY2soaW50ZXJzZWN0cyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdmFyIG1vdXNlb3ZlciA9IFtdLCBtb3VzZW91dCA9IFtdLCBtb3VzZW1vdmUgPSBbXTtcblxuICAgIHZhciBjaGFuZ2VkID0gZmFsc2U7XG4gICAgZm9yKCB2YXIgaSA9IDA7IGkgPCBpbnRlcnNlY3RzLmxlbmd0aDsgaSsrICkge1xuICAgICAgaWYoIHRoaXMuaW50ZXJzZWN0TGlzdC5pbmRleE9mKGludGVyc2VjdHNbaV0pID4gLTEgKSB7XG4gICAgICAgIG1vdXNlbW92ZS5wdXNoKGludGVyc2VjdHNbaV0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY2hhbmdlZCA9IHRydWU7XG4gICAgICAgIG1vdXNlb3Zlci5wdXNoKGludGVyc2VjdHNbaV0pO1xuICAgICAgfVxuICAgIH1cblxuICAgIGZvciggdmFyIGkgPSAwOyBpIDwgdGhpcy5pbnRlcnNlY3RMaXN0Lmxlbmd0aDsgaSsrICkge1xuICAgICAgaWYoIGludGVyc2VjdHMuaW5kZXhPZih0aGlzLmludGVyc2VjdExpc3RbaV0pID09IC0xICkge1xuICAgICAgICBjaGFuZ2VkID0gdHJ1ZTtcbiAgICAgICAgbW91c2VvdXQucHVzaCh0aGlzLmludGVyc2VjdExpc3RbaV0pO1xuICAgICAgfVxuICAgIH1cblxuICAgIHRoaXMuaW50ZXJzZWN0TGlzdCA9IGludGVyc2VjdHM7XG5cbiAgICBpZiggdGhpcy5vbk1vdXNlT3ZlciAmJiBtb3VzZW92ZXIubGVuZ3RoID4gMCApIHRoaXMub25Nb3VzZU92ZXIuY2FsbCh0aGlzLCBtb3VzZW92ZXIsIGUpO1xuICAgIGlmKCB0aGlzLm9uTW91c2VNb3ZlICkgdGhpcy5vbk1vdXNlTW92ZS5jYWxsKHRoaXMsIG1vdXNlbW92ZSwgZSk7IC8vIGFsd2F5cyBmaXJlXG4gICAgaWYoIHRoaXMub25Nb3VzZU91dCAmJiBtb3VzZW91dC5sZW5ndGggPiAwICkgdGhpcy5vbk1vdXNlT3V0LmNhbGwodGhpcywgbW91c2VvdXQsIGUpO1xuXG4gICAgaWYoIHRoaXMuZGVidWcgKSBjb25zb2xlLmxvZygnaW50ZXJzZWN0cyB0aW1lOiAnKyhuZXcgRGF0ZSgpLmdldFRpbWUoKSAtIHQpKydtcycpO1xuXG4gICAgaWYoIGNoYW5nZWQgKSB0aGlzLnJlbmRlcigpO1xuICB9XG59KTtcbiIsIm1vZHVsZS5leHBvcnRzID0ge1xuICBtb3ZlTGluZSA6IGZ1bmN0aW9uKGNvb3JkcywgZGlmZikge1xuICAgIHZhciBpOyBsZW4gPSBjb29yZHMubGVuZ3RoO1xuICAgIGZvciggaSA9IDA7IGkgPCBsZW47IGkrKyApIHtcbiAgICAgIGNvb3Jkc1tpXS54ICs9IGRpZmYueDtcbiAgICAgIGNvb3Jkc1tpXS55ICs9IGRpZmYueTtcbiAgICB9XG4gIH0sXG5cbiAgcHJvamVjdExpbmUgOiBmdW5jdGlvbihjb29yZHMsIG1hcCkge1xuICAgIHZhciB4eUxpbmUgPSBbXTtcblxuICAgIGZvciggdmFyIGkgPSAwOyBpIDwgY29vcmRzLmxlbmd0aDsgaSsrICkge1xuICAgICAgeHlMaW5lLnB1c2gobWFwLmxhdExuZ1RvQ29udGFpbmVyUG9pbnQoW1xuICAgICAgICAgIGNvb3Jkc1tpXVsxXSwgY29vcmRzW2ldWzBdXG4gICAgICBdKSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHh5TGluZTtcbiAgfSxcblxuICBjYWxjQm91bmRzIDogZnVuY3Rpb24oY29vcmRzKSB7XG4gICAgdmFyIHhtaW4gPSBjb29yZHNbMF1bMV07XG4gICAgdmFyIHhtYXggPSBjb29yZHNbMF1bMV07XG4gICAgdmFyIHltaW4gPSBjb29yZHNbMF1bMF07XG4gICAgdmFyIHltYXggPSBjb29yZHNbMF1bMF07XG5cbiAgICBmb3IoIHZhciBpID0gMTsgaSA8IGNvb3Jkcy5sZW5ndGg7IGkrKyApIHtcbiAgICAgIGlmKCB4bWluID4gY29vcmRzW2ldWzFdICkgeG1pbiA9IGNvb3Jkc1tpXVsxXTtcbiAgICAgIGlmKCB4bWF4IDwgY29vcmRzW2ldWzFdICkgeG1heCA9IGNvb3Jkc1tpXVsxXTtcblxuICAgICAgaWYoIHltaW4gPiBjb29yZHNbaV1bMF0gKSB5bWluID0gY29vcmRzW2ldWzBdO1xuICAgICAgaWYoIHltYXggPCBjb29yZHNbaV1bMF0gKSB5bWF4ID0gY29vcmRzW2ldWzBdO1xuICAgIH1cblxuICAgIHZhciBzb3V0aFdlc3QgPSBMLmxhdExuZyh4bWluLS4wMSwgeW1pbi0uMDEpO1xuICAgIHZhciBub3J0aEVhc3QgPSBMLmxhdExuZyh4bWF4Ky4wMSwgeW1heCsuMDEpO1xuXG4gICAgcmV0dXJuIEwubGF0TG5nQm91bmRzKHNvdXRoV2VzdCwgbm9ydGhFYXN0KTtcbiAgfSxcblxuICBnZW9tZXRyeVdpdGhpblJhZGl1cyA6IGZ1bmN0aW9uKGdlb21ldHJ5LCB4eVBvaW50cywgY2VudGVyLCB4eVBvaW50LCByYWRpdXMpIHtcbiAgICBpZiAoZ2VvbWV0cnkudHlwZSA9PSAnUG9pbnQnKSB7XG4gICAgICByZXR1cm4gdGhpcy5wb2ludERpc3RhbmNlKGdlb21ldHJ5LCBjZW50ZXIpIDw9IHJhZGl1cztcbiAgICB9IGVsc2UgaWYgKGdlb21ldHJ5LnR5cGUgPT0gJ0xpbmVTdHJpbmcnICkge1xuXG4gICAgICBmb3IoIHZhciBpID0gMTsgaSA8IHh5UG9pbnRzLmxlbmd0aDsgaSsrICkge1xuICAgICAgICBpZiggdGhpcy5saW5lSW50ZXJzZWN0c0NpcmNsZSh4eVBvaW50c1tpLTFdLCB4eVBvaW50c1tpXSwgeHlQb2ludCwgMykgKSB7XG4gICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH0gZWxzZSBpZiAoZ2VvbWV0cnkudHlwZSA9PSAnUG9seWdvbicgfHwgZ2VvbWV0cnkudHlwZSA9PSAnTXVsdGlQb2x5Z29uJykge1xuICAgICAgcmV0dXJuIHRoaXMucG9pbnRJblBvbHlnb24oY2VudGVyLCBnZW9tZXRyeSk7XG4gICAgfVxuICB9LFxuXG4gIC8vIGh0dHA6Ly9tYXRoLnN0YWNrZXhjaGFuZ2UuY29tL3F1ZXN0aW9ucy8yNzU1MjkvY2hlY2staWYtbGluZS1pbnRlcnNlY3RzLXdpdGgtY2lyY2xlcy1wZXJpbWV0ZXJcbiAgLy8gaHR0cHM6Ly9lbi53aWtpcGVkaWEub3JnL3dpa2kvRGlzdGFuY2VfZnJvbV9hX3BvaW50X3RvX2FfbGluZVxuICAvLyBbbG5nIHgsIGxhdCwgeV1cbiAgbGluZUludGVyc2VjdHNDaXJjbGUgOiBmdW5jdGlvbihsaW5lUDEsIGxpbmVQMiwgcG9pbnQsIHJhZGl1cykge1xuICAgIHZhciBkaXN0YW5jZSA9XG4gICAgICBNYXRoLmFicyhcbiAgICAgICAgKChsaW5lUDIueSAtIGxpbmVQMS55KSpwb2ludC54KSAtICgobGluZVAyLnggLSBsaW5lUDEueCkqcG9pbnQueSkgKyAobGluZVAyLngqbGluZVAxLnkpIC0gKGxpbmVQMi55KmxpbmVQMS54KVxuICAgICAgKSAvXG4gICAgICBNYXRoLnNxcnQoXG4gICAgICAgIE1hdGgucG93KGxpbmVQMi55IC0gbGluZVAxLnksIDIpICsgTWF0aC5wb3cobGluZVAyLnggLSBsaW5lUDEueCwgMilcbiAgICAgICk7XG4gICAgcmV0dXJuIGRpc3RhbmNlIDw9IHJhZGl1cztcbiAgfSxcblxuICAvLyBodHRwOi8vd2lraS5vcGVuc3RyZWV0bWFwLm9yZy93aWtpL1pvb21fbGV2ZWxzXG4gIC8vIGh0dHA6Ly9zdGFja292ZXJmbG93LmNvbS9xdWVzdGlvbnMvMjc1NDUwOTgvbGVhZmxldC1jYWxjdWxhdGluZy1tZXRlcnMtcGVyLXBpeGVsLWF0LXpvb20tbGV2ZWxcbiAgbWV0ZXJzUGVyUHggOiBmdW5jdGlvbihsbCwgbWFwKSB7XG4gICAgdmFyIHBvaW50QyA9IG1hcC5sYXRMbmdUb0NvbnRhaW5lclBvaW50KGxsKTsgLy8gY29udmVydCB0byBjb250YWluZXJwb2ludCAocGl4ZWxzKVxuICAgIHZhciBwb2ludFggPSBbcG9pbnRDLnggKyAxLCBwb2ludEMueV07IC8vIGFkZCBvbmUgcGl4ZWwgdG8geFxuXG4gICAgLy8gY29udmVydCBjb250YWluZXJwb2ludHMgdG8gbGF0bG5nJ3NcbiAgICB2YXIgbGF0TG5nQyA9IG1hcC5jb250YWluZXJQb2ludFRvTGF0TG5nKHBvaW50Qyk7XG4gICAgdmFyIGxhdExuZ1ggPSBtYXAuY29udGFpbmVyUG9pbnRUb0xhdExuZyhwb2ludFgpO1xuXG4gICAgdmFyIGRpc3RhbmNlWCA9IGxhdExuZ0MuZGlzdGFuY2VUbyhsYXRMbmdYKTsgLy8gY2FsY3VsYXRlIGRpc3RhbmNlIGJldHdlZW4gYyBhbmQgeCAobGF0aXR1ZGUpXG4gICAgcmV0dXJuIGRpc3RhbmNlWDtcbiAgfSxcblxuICAvLyBmcm9tIGh0dHA6Ly93d3cubW92YWJsZS10eXBlLmNvLnVrL3NjcmlwdHMvbGF0bG9uZy5odG1sXG4gIHBvaW50RGlzdGFuY2UgOiBmdW5jdGlvbiAocHQxLCBwdDIpIHtcbiAgICB2YXIgbG9uMSA9IHB0MS5jb29yZGluYXRlc1swXSxcbiAgICAgIGxhdDEgPSBwdDEuY29vcmRpbmF0ZXNbMV0sXG4gICAgICBsb24yID0gcHQyLmNvb3JkaW5hdGVzWzBdLFxuICAgICAgbGF0MiA9IHB0Mi5jb29yZGluYXRlc1sxXSxcbiAgICAgIGRMYXQgPSB0aGlzLm51bWJlclRvUmFkaXVzKGxhdDIgLSBsYXQxKSxcbiAgICAgIGRMb24gPSB0aGlzLm51bWJlclRvUmFkaXVzKGxvbjIgLSBsb24xKSxcbiAgICAgIGEgPSBNYXRoLnBvdyhNYXRoLnNpbihkTGF0IC8gMiksIDIpICsgTWF0aC5jb3ModGhpcy5udW1iZXJUb1JhZGl1cyhsYXQxKSlcbiAgICAgICAgKiBNYXRoLmNvcyh0aGlzLm51bWJlclRvUmFkaXVzKGxhdDIpKSAqIE1hdGgucG93KE1hdGguc2luKGRMb24gLyAyKSwgMiksXG4gICAgICBjID0gMiAqIE1hdGguYXRhbjIoTWF0aC5zcXJ0KGEpLCBNYXRoLnNxcnQoMSAtIGEpKTtcbiAgICByZXR1cm4gKDYzNzEgKiBjKSAqIDEwMDA7IC8vIHJldHVybnMgbWV0ZXJzXG4gIH0sXG5cbiAgcG9pbnRJblBvbHlnb24gOiBmdW5jdGlvbiAocCwgcG9seSkge1xuICAgIHZhciBjb29yZHMgPSAocG9seS50eXBlID09IFwiUG9seWdvblwiKSA/IFsgcG9seS5jb29yZGluYXRlcyBdIDogcG9seS5jb29yZGluYXRlc1xuXG4gICAgdmFyIGluc2lkZUJveCA9IGZhbHNlXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBjb29yZHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmICh0aGlzLnBvaW50SW5Cb3VuZGluZ0JveChwLCB0aGlzLmJvdW5kaW5nQm94QXJvdW5kUG9seUNvb3Jkcyhjb29yZHNbaV0pKSkgaW5zaWRlQm94ID0gdHJ1ZVxuICAgIH1cbiAgICBpZiAoIWluc2lkZUJveCkgcmV0dXJuIGZhbHNlXG5cbiAgICB2YXIgaW5zaWRlUG9seSA9IGZhbHNlXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBjb29yZHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmICh0aGlzLnBucG9seShwLmNvb3JkaW5hdGVzWzFdLCBwLmNvb3JkaW5hdGVzWzBdLCBjb29yZHNbaV0pKSBpbnNpZGVQb2x5ID0gdHJ1ZVxuICAgIH1cblxuICAgIHJldHVybiBpbnNpZGVQb2x5XG4gIH0sXG5cbiAgcG9pbnRJbkJvdW5kaW5nQm94IDogZnVuY3Rpb24gKHBvaW50LCBib3VuZHMpIHtcbiAgICByZXR1cm4gIShwb2ludC5jb29yZGluYXRlc1sxXSA8IGJvdW5kc1swXVswXSB8fCBwb2ludC5jb29yZGluYXRlc1sxXSA+IGJvdW5kc1sxXVswXSB8fCBwb2ludC5jb29yZGluYXRlc1swXSA8IGJvdW5kc1swXVsxXSB8fCBwb2ludC5jb29yZGluYXRlc1swXSA+IGJvdW5kc1sxXVsxXSlcbiAgfSxcblxuICBib3VuZGluZ0JveEFyb3VuZFBvbHlDb29yZHMgOiBmdW5jdGlvbihjb29yZHMpIHtcbiAgICB2YXIgeEFsbCA9IFtdLCB5QWxsID0gW11cblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgY29vcmRzWzBdLmxlbmd0aDsgaSsrKSB7XG4gICAgICB4QWxsLnB1c2goY29vcmRzWzBdW2ldWzFdKVxuICAgICAgeUFsbC5wdXNoKGNvb3Jkc1swXVtpXVswXSlcbiAgICB9XG5cbiAgICB4QWxsID0geEFsbC5zb3J0KGZ1bmN0aW9uIChhLGIpIHsgcmV0dXJuIGEgLSBiIH0pXG4gICAgeUFsbCA9IHlBbGwuc29ydChmdW5jdGlvbiAoYSxiKSB7IHJldHVybiBhIC0gYiB9KVxuXG4gICAgcmV0dXJuIFsgW3hBbGxbMF0sIHlBbGxbMF1dLCBbeEFsbFt4QWxsLmxlbmd0aCAtIDFdLCB5QWxsW3lBbGwubGVuZ3RoIC0gMV1dIF1cbiAgfSxcblxuICAvLyBQb2ludCBpbiBQb2x5Z29uXG4gIC8vIGh0dHA6Ly93d3cuZWNzZS5ycGkuZWR1L0hvbWVwYWdlcy93cmYvUmVzZWFyY2gvU2hvcnRfTm90ZXMvcG5wb2x5Lmh0bWwjTGlzdGluZyB0aGUgVmVydGljZXNcbiAgcG5wb2x5IDogZnVuY3Rpb24oeCx5LGNvb3Jkcykge1xuICAgIHZhciB2ZXJ0ID0gWyBbMCwwXSBdXG5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGNvb3Jkcy5sZW5ndGg7IGkrKykge1xuICAgICAgZm9yICh2YXIgaiA9IDA7IGogPCBjb29yZHNbaV0ubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgdmVydC5wdXNoKGNvb3Jkc1tpXVtqXSlcbiAgICAgIH1cbiAgICAgIHZlcnQucHVzaChjb29yZHNbaV1bMF0pXG4gICAgICB2ZXJ0LnB1c2goWzAsMF0pXG4gICAgfVxuXG4gICAgdmFyIGluc2lkZSA9IGZhbHNlXG4gICAgZm9yICh2YXIgaSA9IDAsIGogPSB2ZXJ0Lmxlbmd0aCAtIDE7IGkgPCB2ZXJ0Lmxlbmd0aDsgaiA9IGkrKykge1xuICAgICAgaWYgKCgodmVydFtpXVswXSA+IHkpICE9ICh2ZXJ0W2pdWzBdID4geSkpICYmICh4IDwgKHZlcnRbal1bMV0gLSB2ZXJ0W2ldWzFdKSAqICh5IC0gdmVydFtpXVswXSkgLyAodmVydFtqXVswXSAtIHZlcnRbaV1bMF0pICsgdmVydFtpXVsxXSkpIGluc2lkZSA9ICFpbnNpZGVcbiAgICB9XG5cbiAgICByZXR1cm4gaW5zaWRlXG4gIH0sXG5cbiAgbnVtYmVyVG9SYWRpdXMgOiBmdW5jdGlvbiAobnVtYmVyKSB7XG4gICAgcmV0dXJuIG51bWJlciAqIE1hdGguUEkgLyAxODA7XG4gIH1cbn07XG4iXX0=
