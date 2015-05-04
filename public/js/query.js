
$(window).ready(function(){
	init();
});


function init() {
	$('#date').val(new Date().toISOString().split('T')[0]);

	$('#query').on('keypress', function(e){
		if( e.which == 13 ) run();
	});

	$('#exec').on('click', function(){
		run();
	});

	$('#exQueryBtn').on('click', function(){
		$('#examples').toggle('slow');
	});
	$('.sample').on('click', runSample);
}

function ready() {
	var query = new google.visualization.Query('http://watershed.ice.ucdavis.edu/vizsource/rest?view=watersheds&tq=SELECT * order by watershed');
  	query.send(function(response){
  		if (response.isError()) {
	      $('#response').html('<div class="alert alert-danger">Error in query: ' + response.getMessage() + ' '
	      		+ response.getDetailedMessage()+'</div>');
	      return;
	    }

	    var data = response.getDataTable();
	    var select = $('#watershed');
	    for( var i = 0; i < data.getNumberOfRows(); i++ ) {
    		if( data.getValue(i, 0) ) select.append('<option value="'+data.getValue(i, 0)+'">'+data.getValue(i, 0)+'</option>');
    	};

    	$('#exec').removeClass('disabled').html('Execute');
  	});
}

function runSample(e) {
	$('#table').val('demand');
	$('#watershed').val('EEL RIVER');
	$('#date').val('2014-05-01');
	var query = $('#'+$(this).attr('query')).text();
	$('#query').val(query);
	run();
	$('#examples').toggle('slow');
}

function run() {
	$('#exec').addClass('disabled').html('<i class="fa fa-spinner fa-spin"></i> Executing Query...');

	// [table]([date],[watershed]);

	// demand date -> unlimited
	// supply & allocation ->

	var table = $('#table').val();
	var date = $('#date').val();

	var link = 'http://watershed.ice.ucdavis.edu/vizsource/rest?view='+table+'(\''+date+'\',\''+$('#watershed').val()+'\')&tq='+$('#query').val();

	var query = new google.visualization.Query(link);
  	query.send(function(response){
  		$('#exec').removeClass('disabled').html('Execute');

  		if (response.isError()) {
	      $('#response').html('<div class="alert alert-danger">Error in query: ' + response.getMessage() + ' '
	      		+ response.getDetailedMessage()+'</div>');
	      return;
	    }

	    var data = response.getDataTable();

	    $('#response').html('<h2 style="text-align:center">Result</h2><div id="response-links"></div>'+
	    	'<div id="response-table"></div>');

	    $('#response-links').append('<a class="btn btn-default" target="_blank" href="'+link+'"><i class="fa fa-link"></i> REST Link</a>');
	    $('#response-links').append('<a class="btn btn-default" target="_blank" href="'+link+'&tqx=out:csv"><i class="fa fa-table"></i> CSV</a>');
	    $('#response-links').append('<a class="btn btn-default" target="_blank" href="'+link+'&tqx=out:html"><i class="fa fa-code"></i> HTML</a>');

	    var table = new google.visualization.Table($('#response-table')[0]);
		table.draw(data, {});
  	});
}
