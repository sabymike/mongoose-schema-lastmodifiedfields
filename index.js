'use strict';
var _ = require('lodash');

var defaultOptions = {
    fieldSuffix: '_lastModifiedDate',
    purgeFromJSON: false,
    purgeFromObject: false,
    overwrite: true
};

module.exports = exports = function lastModifiedFields(schema, options) {
    options = _.extend(defaultOptions, options);
    var omittedFields = _.union(options.omittedFields, ['_id', schema.options.discriminatorKey, schema.options.versionKey]);
    var modifedFieldSuffix = options.fieldSuffix;

    schema.eachPath(function(pathName, schemaName) {
        // if the path does not already have the modification date suffix, and we are supposed to be inluding this
        if (!_.contains(pathName, modifedFieldSuffix) && !_.contains(omittedFields, pathName)) {
            var addObj = {};
            addObj[pathName + modifedFieldSuffix] = {
                type: Date
            };
            schema.add(addObj);
        }
    });

    schema.pre('save', function(next) {
        var updateTimestamp = new Date();
        var modifiedPaths = this.modifiedPaths();

        _.each(modifiedPaths, function(pathName) {
            if (!_.contains(pathName, modifedFieldSuffix) &&
                (options.overwrite || !_.contains(modifiedPaths, pathName + modifedFieldSuffix))) {

                var modifiedDatePath = pathName + modifedFieldSuffix;
                if (this.schema.paths[modifiedDatePath]) {
                    this.set(modifiedDatePath, updateTimestamp);
                }
            }
        }, this);
        next();
    });

    var transObj = {
        transform: function(doc, ret, options) {
            _.forIn(ret, function(v, k) {
                if (_.contains(k, modifedFieldSuffix)) {
                    delete ret[k];
                }
            });
        }
    };

    if (options.purgeFromJSON) {
        schema.set('toJSON', transObj);
    }

    if (options.purgeFromObject) {
        schema.set('toObject', transObj);
    }

    schema.statics.getModifiedFieldSuffix = function() {
        return modifedFieldSuffix;
    };
};
