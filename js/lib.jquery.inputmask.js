/*
 * Input Mask plugin for jquery
 * http://github.com/RobinHerbots/jquery.inputmask
 * Copyright (c) 2010 -	Robin Herbots
 * Licensed under the MIT license (http://www.opensource.org/licenses/mit-license.php)
 * Version: 0.0.0-dev
 */

(function(factory) {
    if (typeof define === 'function' && define.amd) {
        define(['jquery', 'inputmask'], factory);
    } else if (typeof exports === 'object') {
        module.exports = factory(require('jquery'), require('./inputmask'));
    } else {
        factory(jQuery, window.Inputmask);
    }
}(function($, Inputmask) {
    if ($.fn.inputmask === undefined) {
        //jquery plugin
        $.fn.inputmask = function(fn, options) {
            var nptmask, input;
            options = options || {};
            if (typeof fn === 'string') {
                switch (fn) {
                case 'mask':
                    nptmask = new Inputmask(options);
                    return this.each(function() {
                        nptmask.mask(this);
                    });
                case 'unmaskedvalue':
                    input = this.jquery && this.length > 0 ? this[0] : this;
                    return input.inputmask ? input.inputmask.unmaskedvalue() : $(input).val();
                case 'remove':
                    return this.each(function() {
                        if (this.inputmask)
                            this.inputmask.remove();
                    });
                case 'getemptymask':
                    input = this.jquery && this.length > 0 ? this[0] : this;
                    return input.inputmask ? input.inputmask.getemptymask() : '';
                case 'hasMaskedValue':
                    //check wheter the returned value is masked or not; currently only works reliable when using jquery.val fn to retrieve the value
                    input = this.jquery && this.length > 0 ? this[0] : this;
                    return input.inputmask ? input.inputmask.hasMaskedValue() : false;
                case 'isComplete':
                    input = this.jquery && this.length > 0 ? this[0] : this;
                    return input.inputmask ? input.inputmask.isComplete() : true;
                case 'getmetadata':
                    //return mask metadata if exists
                    input = this.jquery && this.length > 0 ? this[0] : this;
                    return input.inputmask ? input.inputmask.getmetadata() : undefined;
                case 'setvalue':
                    input = this.jquery && this.length > 0 ? this[0] : this;
                    $(input).val(options);
                    if (input.inputmask !== undefined) {
                        $(input).triggerHandler('setvalue.inputmask');
                    }
                    break;
                case 'option':
                    if (typeof options === 'string') {
                        input = this.jquery && this.length > 0 ? this[0] : this;
                        if (input.inputmask !== undefined) {
                            return input.inputmask.option(options);
                        }
                    } else {
                        return this.each(function() {
                            if (this.inputmask !== undefined) {
                                return this.inputmask.option(options);
                            }
                        });
                    }
                    break;
                default:
                    options.alias = fn;
                    nptmask = new Inputmask(options);
                    return this.each(function() {
                        nptmask.mask(this);
                    });
                }
            } else if (typeof fn == 'object') {
                nptmask = new Inputmask(fn);
                if (fn.mask === undefined && fn.alias === undefined) {
                    return this.each(function() {
                        if (this.inputmask !== undefined) {
                            return this.inputmask.option(fn);
                        } else
                            nptmask.mask(this);
                    });
                } else {
                    return this.each(function() {
                        nptmask.mask(this);
                    });
                }
            } else if (fn === undefined) {
                //look for data-inputmask atributes
                return this.each(function() {
                    nptmask = new Inputmask(options);
                    nptmask.mask(this);
                });
            }
        }
        ;
    }
    return $.fn.inputmask;
}));