## mongoose-schema-lastmodifiedfields

A mongoose plugin that automatically adds last modified fields for each user defined property in a mongoose schema. Each time a document is saved, any modified properties that have corresponding last modified fields will be updated with the current timestamp. This can be useful when syncing data with clients on a per-field basis.

The inspiration for this was a result to extend my mongoose schemas to support real-time and per field data syncing discussed in [@brentsimmons](https://twitter.com/brentsimmons) [post about Vesper syncing here](http://inessential.com/2013/11/13/vesper_sync_diary_6_merging_notes)

#Install
Install via NPM

        npm install mongoose-schema-lastmodifiedfields

# Usage
```
var mongoose = require('mongoose'),
    lastModifiedFields = require('lastModifiedFields');

var CarSchema = new mongoose.Schema({
    make:String,
    model:String,
    vin:String
    miles:Number
});

var options = {
    fieldSuffix: '_lastModified',
    omittedFields: ['make', 'model']
};

CarSchema.plugin(lastModifiedFields, options);
```

###Options
The plugin currently has the following options

- ####fieldSuffix
A string to append to the end of each path to determine the name of each timestamp field. Defaults to '_lastModifiedDate'

- ####omittedFields
An array of field names that should not have timestamp fields created for them.
Defaults:
    - Standard id key '**_id**'
    - Discriminator Key (typically '**__t**')
    - Version key (typically '**__v**')

- ####purgeFromJSON
Boolean that transforms the schema's toJSON method to remove the timestamp fields from its JSON representation. Defaults to 'false'

- ####purgeFromObject
Boolean that transforms the schema's toObject method to remove the timestamp fields from its Object representation. Defaults to 'false'

- ####overwrite
Boolean to determine whether the plugin should overwrite _lastModifiedDate fields, even if they were explicitly modified. Defaults to 'true'
_Note:_ Dates are treated a little differently in mongoose. To be included in `schema.modifiedPaths()`, the date must either be set via `doc.set(...)` or marked explicitly with `doc.markmodified(...)`. A simple assignment does not flag a date as modified. For more information, see http://mongoosejs.com/docs/schematypes.html#Dates.

- ####select
Boolean to determine whether the plugin should return _lastModifiedDate fields from a database query by default. This can be overridden on a per-query basis. There is no Default value. For more information, see http://mongoosejs.com/docs/api.html#schematype_SchemaType-select.

###Methods
The `modifedFieldSuffix` is exposed by a convenience method on the schema for easy access via `getModifiedFieldSuffix`.

The array of paths to which modifedFieldSuffix has been added is exposed by via `getModifiedFieldPaths`.

```
var Car = mongoose.model('Car', CarSchema);
var modifiedFieldSuffix = Car.getModifiedFieldSuffix();
var modifiedFieldPaths = Car.getModifiedFieldPaths();
```


# Tests
Test can be run by simply running `npm test` or by installing and running mocha.

    npm test

_or:_

    npm install -g mocha
    mocha

#Authors
Mike Sabatini [@mikesabatini](https://twitter.com/mikesabatini)

#License
Copyright Mike Sabatini 2014
Licensed under the MIT License. Enjoy!
