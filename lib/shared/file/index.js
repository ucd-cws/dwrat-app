var process = require('./process');

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
        for( i = index; i < index+200; i++ ) {
            if( ids.length == i ) break;
            idGroup.push(ids[i]);
        }
        index += 200;
        console.log(index);



        var query = new google.visualization.Query('http://watershed.ice.ucdavis.edu/vizsource/rest?view=locate(\''+
            idGroup.join(',')+'\')&tq=SELECT *');
        query.send(function(resp){
            if( resp.isError() ) {
                console.log(resp.getMessage());
            } else {
                var dt = resp.getDataTable();
                for( var i = 0; i < dt.getNumberOfRows(); i++ ) {
                    locations[dt.getValue(i, 0)] = JSON.parse(dt.getValue(i, 2));
                }
            }

            $('#file-locate').html('Locating data '+((index/ids.length).toFixed(2)*100)+'%...');
            locateData(index, ids, callback);
        });
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
