# Setting up the Server
[_Back to the Table of Contents_](./index.md)

## Requirements
This code base comes precompiled into a client-side Javascript web application. As such, it only requires a standard web server
capable of hosting a directory of files in order to be served.

## Dependencies
The built version of this software has no software dependencies to run. However, in order to reliably
serve data, it does rely on data hosted in three external locations:

1. Google Docs
2. Center for Watershed Sciences ArcGIS Server
    * http://atlas.cws.ucdavis.edu/arcgis/rest/services/Watersheds/
        * WMS and WFS should be enabled
        * Currently used in app.js, line 518 for `var lookupUrl` and app.js line 1325 in `var wms2`
    * http://atlas.cws.ucdavis.edu/arcgis/rest/services/CalWater_Hydrologic_Unit/
        * Standard ArcGIS services enabled
        * Currently used in app.js line 1325 for `var wms1`
3. SWRCB ArcGIS Server
    * http://gispublic.waterboards.ca.gov/arcgis/rest/services/Water_Rights/Points_of_Diversion/

Services hosted on CWS infrastructure can be passed to SWRCB for hosting on their ArcGIS servers. The aforementioned features
must be enabled for each service, and the code should be edited at the mentioned locations to correctly reference the new services.