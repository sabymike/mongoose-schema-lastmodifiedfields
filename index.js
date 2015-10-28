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
    var modifiedFieldSuffix = options.fieldSuffix;

    schema.eachPath(function(pathName) {
        // if the path does not already have the modification date suffix, and we are supposed to be inluding this
        if (!_.contains(pathName, modifiedFieldSuffix) && !_.contains(omittedFields, pathName)) {
            pathName = pathName + modifiedFieldSuffix;
            var addObj = _.set({}, pathName, {
                type: Date
            });
            if (_.has(options, 'select')) {
                _.set(addObj, pathName + '.select', options.select); // set default select behavior
            }
            schema.add(addObj);
        }
    });

    schema.pre('save', function(next) {
        var updateTimestamp = new Date();
        var modifiedPaths = this.modifiedPaths();

        _.each(modifiedPaths, function(pathName) {
            if (!_.contains(pathName, modifiedFieldSuffix) &&
                (options.overwrite || !_.contains(modifiedPaths, pathName + modifiedFieldSuffix))) {

                var modifiedDatePath = pathName + modifiedFieldSuffix;
                if (this.schema.paths[modifiedDatePath]) {
                    this.set(modifiedDatePath, updateTimestamp);
                }
            }
        }, this);
        next();
    });

    var transObj = {
        transform: function(doc, ret, options) {
            return _.omit(ret, function(v, k) {
                return _.contains(k, modifiedFieldSuffix);
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
        return modifiedFieldSuffix;
    };

    schema.statics.getModifiedFieldPaths = function() {
        return _.filter(_.keys(schema.paths), function(k) {
            return _.contains(k, modifiedFieldSuffix);
        });
    };
};
