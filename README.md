## mongoose-schema-lastmodifiedfields

A mongoose plugin that automatically adds last modified fields for each user defined property in a mongoose schema. Each time a document is saved, any modified properties that have corresponding last modified fields will be updated with the current timestamp. This can be useful when syncing data with clients on a per-field basis.

The inspiration for this was a result to extend my mongoose schemas to support real-time and per field data syncing discussed in [@brentsimmons](https://twitter.com/brentsimmons) [post about Vesper syncing here](http://inessential.com/2013/11/13/vesper_sync_diary_6_merging_notes)

# Usage
```
var mongoose = require("mongoose"),
    lastModifiedFields = require("lastModifiedFields");

var CarSchema = new mongoose.Schema({
    make:String,
    model:String,
    vin:String
    miles:Number
});

CarSchema.plugin(lastModifiedFields, {fieldSuffix:"_lastModified",
                                      omittedFields:["make", "model"]});
```

###Options
The plugin can currently take two options

- ####fieldSuffix
A string to append to the end of each path to determine the name of each timestamp field. Defaults to "_lastModifiedDate"
    
- ####omittedFields
An array of field names that should not have timestamp fields created for them. 
Defaults:
    - Standard id key "**_id**"
    - Discriminator Key (typically "**__t**")
    - Version key (typically "**__v**")

# Tests
Test can be run simply by installing and running mocha

    npm install -g mocha
    mocha

#Authors
Mike Sabatini (@mikesabatini)[https://twitter.com/mikesabatini]

#License
Copyright Mike Sabatini 2014
Licensed under the MIT License. Enjoy