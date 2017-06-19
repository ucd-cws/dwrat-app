# Adding New Data to Public Directory
[_Back to the Table of Contents_](./index.md)

The "Public Directory" portion of the application is where data can be uploaded for permanent usage - accessible by anyone
who loads the application. When using the application, these items can be accessed by clicking "Public Dirctory" in the top
right corner, then selecting the relevant filename to load data from for display.

## The master spreadsheet
These data are indexed in [the "DWRAT Runs" stored in Google Sheets](https://docs.google.com/spreadsheets/d/1ACi7P0pOy-JRjtw6HribQphhEOZ-0-CkQ_mqnyCfJcI/).
If you will need to add a new item to the Public Directory, please load that spreadsheet and click the icon that says
"View Only" - then click "Request Edit Access". Once access is provided, you'll have the access needed to add items
to the public directory.

## Adding an item
To add an item to the public directory, upload the data as a new sheet. Share the spreadsheet publicly (for viewing only),
then copy the ID in the URL of that spreadsheet for use in the master spreadsheet. For example, if the URL of the uploaded
spreadsheet is `https://docs.google.com/spreadsheets/d/1ACi7P0pOy-JRjtw6HribQphhEOZ-0-CkQ_mqnyCfJcI/` the ID you need is
`1ACi7P0pOy-JRjtw6HribQphhEOZ-0-CkQ_mqnyCfJcI`. If the URL has any more information following that ID, exclude it - only
use the portion mentioned here.

From there, create a new record in the master spreadsheet. Place that ID in the `ID` column of the record, then enter
the other details you want to show in the public view of the spreadsheet, including a name, start date, and end date.
 Once you have added the record, the new data will be available in the `Public Directory` portion of the application.

## Changing the master spreadsheet
For administrators of the site, if the spreadsheet used for the Public Directory index needs to be changed, do the following:
1. Make a new Google Sheet
2. Share the sheet so that it is publicly viewable, but not publicly editable
3. Edit the sheet URL into the code by finding the line where public_dir_root is defined - it will start with `var public_dir_root = `.
 As of this writing, the line is in app.js on line 1076, but that is subject to change in future builds.
4. Relaunch the application