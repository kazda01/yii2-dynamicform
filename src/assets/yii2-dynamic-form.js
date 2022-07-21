/**
 * yii2-dynamic-form
 *
 * A jQuery plugin to clone form elements in a nested manner, maintaining accessibility.
 *
 * @author Wanderson Bragança <wanderson.wbc@gmail.com>
 * @contributor Vivek Marakana <vivek.marakana@gmail.com>
 * @contributor Yoda <user1007017@gmail.com>
 * @contributor Vivek Marakana <vivek.marakana@gmail.com>
 */
(function ($) {
    var pluginName = 'yiiDynamicForm';

    var regexID = /^(.+?)([-\d-]{1,})(.+)$/i;

    var regexName = /(^.+?)([\[\d{1,}\]]{1,})(\[.+\]$)/i;

    $.fn.yiiDynamicForm = function (method) {
        if (methods[method]) {
            return methods[method].apply(this, Array.prototype.slice.call(arguments, 1));
        } else if (typeof method === 'object' || !method) {
            return methods.init.apply(this, arguments);
        } else {
            $.error('Method ' + method + ' does not exist on jQuery.yiiDynamicForm');
            return false;
        }
    };

    var events = {
        beforeInsert: 'beforeInsert',
        afterInsert: 'afterInsert',
        beforeDelete: 'beforeDelete',
        afterDelete: 'afterDelete',
        limitReached: 'limitReached'
    };

    var methods = {
        init: function (widgetOptions) {
            return this.each(function () {
                widgetOptions.template = _parseTemplate(widgetOptions);
            });
        },

        addItem: function (widgetOptions, e, $elem) {
            _addItem(widgetOptions, e, $elem);
        },

        deleteItem: function (widgetOptions, e, $elem) {
            _deleteItem(widgetOptions, e, $elem);
        },

        updateContainer: function () {
            var widgetOptions = eval($(this).attr('data-dynamicform'));
            _updateAttributes(widgetOptions);
            _restoreSpecialJs(widgetOptions);
            _fixFormValidaton(widgetOptions);
        }
    };

    var _parseTemplate = function(widgetOptions) {
        var $template = $(widgetOptions.template);
        $template.find('div[data-dynamicform]').each(function(){
            var widgetOptions = eval($(this).attr('data-dynamicform'));
            if ($(widgetOptions.widgetItem).length > 1) {
                if($(this).find(widgetOptions.widgetItem).first().length > 0){
		    var item = $(this).find(widgetOptions.widgetItem).first()[0].outerHTML;
                    $(this).find(widgetOptions.widgetBody).html(item);
		}
            }
        });

        $template.find('input, textarea, select').each(function() {
            if ($(this).is(':checkbox') || $(this).is(':radio')) {
                var type         = ($(this).is(':checkbox')) ? 'checkbox' : 'radio';
                var inputName    = $(this).attr('name');
                var $inputHidden = $template.find('input[type="hidden"][name="' + inputName + '"]').first();
                var count        = $template.find('input[type="' + type +'"][name="' + inputName + '"]').length;

                if ($inputHidden && count === 1) {
                    $(this).val(1);
                    $inputHidden.val(0);
                }

                $(this).prop('checked', false);
            } else if($(this).is('select')) {
                $(this).find('option:selected').removeAttr("selected");
            } else {
                $(this).val('');
            }
        });

        // remove "error/success" css class
        var yiiActiveFormData = $('#' + widgetOptions.formId).yiiActiveForm('data');
        if (typeof yiiActiveFormData !== "undefined" && typeof yiiActiveFormData.settings !== "undefined" ) {
            if(typeof yiiActiveFormData.settings.errorCssClass !== "undefined" && yiiActiveFormData.settings.errorCssClass.length > 0) {
                $template.find('.' + yiiActiveFormData.settings.errorCssClass).removeClass(yiiActiveFormData.settings.errorCssClass);
            }

            if(typeof yiiActiveFormData.settings.successCssClass !== "undefined" && yiiActiveFormData.settings.successCssClass.length > 0) {
                $template.find('.' + yiiActiveFormData.settings.successCssClass).removeClass(yiiActiveFormData.settings.successCssClass);
            }
        }

        return $template;
    };

    var _getWidgetOptionsRoot = function(widgetOptions) {
        return eval($('.'+widgetOptions.widgetContainer+' '+widgetOptions.widgetBody).parents('div[data-dynamicform]').last().attr('data-dynamicform'));
    };

    var _getLevel = function($elem) {
        var level = $elem.parents('div[data-dynamicform]').length;
        level = (level < 0) ? 0 : level;
        return level;
    };

    var _count = function($elem, widgetOptions) {
        return $elem.closest('.' + widgetOptions.widgetContainer).find(widgetOptions.widgetItem).length;
    };

    var _createIdentifiers = function(level) {
        return new Array(level + 2).join('0').split('');
    };

    var _addItem = function(widgetOptions, e, $elem) {
        var count = _count($elem, widgetOptions);

        if (count < widgetOptions.limit) {
            if (count == 0) {
            	$toclone = $(widgetOptions.template);
            } else {
            	$toclone = $(widgetOptions.widgetItem).first();
            }
            
            $newclone = $toclone.clone(false, false);

            // Distinct dynamic form items recursively
            __distinctRecursive('[data-dynamicform^=dynamicform]', $newclone);

            if (widgetOptions.insertPosition === 'top') {
                $elem.closest('.' + widgetOptions.widgetContainer).find(widgetOptions.widgetBody).prepend($newclone);
            } else {
                $elem.closest('.' + widgetOptions.widgetContainer).find(widgetOptions.widgetBody).append($newclone);
            }

            _updateAttributes(widgetOptions);
            _restoreSpecialJs(widgetOptions);
            _fixFormValidaton(widgetOptions);
            $elem.closest('.' + widgetOptions.widgetContainer).triggerHandler(events.afterInsert, $newclone);
        } else {
            // trigger a custom event for hooking
            $elem.closest('.' + widgetOptions.widgetContainer).triggerHandler(events.limitReached, widgetOptions.limit);
        }
    };

    // Distinct dynamic form recursively
    var __distinctRecursive = function (regex, $item) {
        var $items = $item.find(regex);

        $.each($items, function (i, item) {
            var formObject = eval($(item).data('dynamicform'));
            var widgetItem = formObject.widgetItem;
            $(item).find(widgetItem + ':not(:nth-child(1))').remove();

            __distinctRecursive(regex, $(item));
        });
    };

    var _removeValidations = function($elem, widgetOptions, count) {
        if (count > 1) {
            $elem.find('div[data-dynamicform]').each(function() {
                var currentWidgetOptions = eval($(this).attr('data-dynamicform'));
                var level           = _getLevel($(this));
                var identifiers     = _createIdentifiers(level);
                var numItems        = $(this).find(currentWidgetOptions.widgetItem).length;

                for (var i = 1; i <= numItems -1; i++) {
                    var aux = identifiers;
                    aux[level] = i;
                    currentWidgetOptions.fields.forEach(function(input) {
                        var id = input.id.replace("{}", aux.join('-'));
                        if ($("#" + currentWidgetOptions.formId).yiiActiveForm("find", id) !== "undefined") {
                            $("#" + currentWidgetOptions.formId).yiiActiveForm("remove", id);
                        }
                    });
                }
            });

            var level          = _getLevel($elem.closest('.' + widgetOptions.widgetContainer));
            var widgetOptionsRoot       = _getWidgetOptionsRoot(widgetOptions);
            var identifiers    = _createIdentifiers(level);
            identifiers[0]     = $(widgetOptionsRoot.widgetItem).length - 1;
            identifiers[level] = count - 1;

            widgetOptions.fields.forEach(function(input) {
                var id = input.id.replace("{}", identifiers.join('-'));
                if ($("#" + widgetOptions.formId).yiiActiveForm("find", id) !== "undefined") {
                    $("#" + widgetOptions.formId).yiiActiveForm("remove", id);
                }
            });
        }
    };

    var _deleteItem = function(widgetOptions, e, $elem) {
        var count = _count($elem, widgetOptions);

        if (count > widgetOptions.min) {
            $todelete = $elem.closest(widgetOptions.widgetItem);

            // trigger a custom event for hooking
            var eventResult = $('.' + widgetOptions.widgetContainer).triggerHandler(events.beforeDelete, $todelete);
            if (eventResult !== false) {
                _removeValidations($todelete, widgetOptions, count);
                $todelete.remove();
                _updateAttributes(widgetOptions);
                _restoreSpecialJs(widgetOptions);
                _fixFormValidaton(widgetOptions);
                $('.' + widgetOptions.widgetContainer).triggerHandler(events.afterDelete);
            }
        }
    };

    var _updateAttrID = function($elem, index) {
        var widgetOptions = eval($elem.closest('div[data-dynamicform]').attr('data-dynamicform'));
        var id            = $elem.attr('id');
        var newID         = id;

        if (id !== undefined) {
            var matches = id.match(regexID);
            if (matches && matches.length === 4) {
                matches[2] = matches[2].substring(1, matches[2].length - 1);
                var identifiers = matches[2].split('-');
                identifiers[0] = index;

                if (identifiers.length > 1) {
                    var widgetsOptions = [];
                    $elem.parents('div[data-dynamicform]').each(function(i){
                        widgetsOptions[i] = eval($(this).attr('data-dynamicform'));
                    });

                    widgetsOptions = widgetsOptions.reverse();

                    for (var i = identifiers.length - 1; i >= 1; i--) {
						if (typeof widgetsOptions[i] !== "undefined") {
							identifiers[i] = $elem.closest(widgetsOptions[i].widgetItem).index();
						}
                        //$(".kv-plugin-loading").addClass("hide");
                    }
                }

                newID = matches[1] + '-' + identifiers.join('-') + '-' + matches[3];
                $elem.attr('id', newID);
            } else {
                newID = id + index;
                $elem.attr('id', newID);
            }
        }

        if (id !== newID && widgetOptions != undefined) {
            $elem.closest(widgetOptions.widgetItem).find('.field-' + id).each(function() {
                $(this).removeClass('field-' + id).addClass('field-' + newID);
            });
            // update "for" attribute
            $elem.closest(widgetOptions.widgetItem).find("label[for='" + id + "']").attr('for',newID);
        }

        return newID;
    };

    var _updateAttrName = function($elem, index) {
        var name = $elem.attr('name');

        if (name !== undefined) {
            var matches = name.match(regexName);

            if (matches && matches.length === 4) {
                matches[2] = matches[2].replace(/\]\[/g, "-").replace(/\]|\[/g, '');
                var identifiers = matches[2].split('-');
                identifiers[0] = index;

                if (identifiers.length > 1) {
                    var widgetsOptions = [];
                    $elem.parents('div[data-dynamicform]').each(function(i){
                        widgetsOptions[i] = eval($(this).attr('data-dynamicform'));
                    });

                    widgetsOptions = widgetsOptions.reverse();
                    for (var i = identifiers.length - 1; i >= 1; i--) {
                        //identifiers[i] = $elem.closest(widgetsOptions[i].widgetItem).index();
                        if(typeof widgetsOptions[i] !== 'undefined'){
                            identifiers[i] = $elem.closest(widgetsOptions[i].widgetItem).index();
                        }
                    }
                }

                name = matches[1] + '[' + identifiers.join('][') + ']' + matches[3];
                $elem.attr('name', name);
            }
        }

        return name;
    };

    var _updateAttributes = function(widgetOptions) {
        var widgetOptionsRoot = _getWidgetOptionsRoot(widgetOptions);
        
        $('.'+widgetOptionsRoot.widgetContainer+' '+widgetOptionsRoot.widgetItem).each(function(index) {
            var $item = $(this);

            $(this).find('*').each(function() {
                // update "id" attribute
                _updateAttrID($(this), index);

                // update "name" attribute
                _updateAttrName($(this), index);
            });
        });
    };

    var _fixFormValidatonInput = function(widgetOptions, attribute, id, name) {
        if (attribute !== undefined) {
            attribute           = $.extend(true, {}, attribute);
            attribute.id        = id;
            attribute.container = ".field-" + id;
            attribute.input     = "#" + id;
            attribute.name      = name;
            attribute.value     = $("#" + id).val();
            attribute.status    = 0;

            if ($("#" + widgetOptions.formId).yiiActiveForm("find", id) !== "undefined") {
                $("#" + widgetOptions.formId).yiiActiveForm("remove", id);
            }

            $("#" + widgetOptions.formId).yiiActiveForm("add", attribute);
        }
    };

    var _fixFormValidaton = function(widgetOptions) {
        var widgetOptionsRoot = _getWidgetOptionsRoot(widgetOptions);

        $(widgetOptionsRoot.widgetBody).find('input, textarea, select').each(function() {
            var id   = $(this).attr('id');
            var name = $(this).attr('name');

			if(id === undefined && $(this).attr('type') == 'radio') {
				/* Kartik Form Builder */
				id = $(this).parents().eq(2).attr('id');
			}
			
            if (id !== undefined && name !== undefined) {
                currentWidgetOptions = eval($(this).closest('div[data-dynamicform]').attr('data-dynamicform'));
                var matches = id.match(regexID);

                if (matches && matches.length === 4) {
                    matches[2]      = matches[2].substring(1, matches[2].length - 1);
                    var level       = _getLevel($(this));
                    var identifiers = _createIdentifiers(level -1);
                    var baseID      = matches[1] + '-' + identifiers.join('-') + '-' + matches[3];
                    var attribute   = $("#" + currentWidgetOptions.formId).yiiActiveForm("find", baseID);
                    _fixFormValidatonInput(currentWidgetOptions, attribute, id, name);
                }
            }
        });
    };

    var _restoreKrajeeDepdrop = function($elem) {
        var configDepdrop = $.extend(true, {}, eval($elem.attr('data-krajee-depdrop')));
        var inputID = $elem.attr('id');
        var matchID = inputID.match(regexID);

        if (matchID && matchID.length === 4) {
            for (index = 0; index < configDepdrop.depends.length; ++index) {
                var match = configDepdrop.depends[index].match(regexID);
                if (match && match.length === 4) {
                    configDepdrop.depends[index] = match[1] + matchID[2] + match[3];
                }
            }
        }

        $elem.depdrop(configDepdrop);
    };

    var _restoreSpecialJs = function(widgetOptions) {
        var widgetOptionsRoot = _getWidgetOptionsRoot(widgetOptions);



        // "jquery.inputmask"
        var $hasInputmask = $(widgetOptionsRoot.widgetItem).find('[data-plugin-inputmask]');
        if ($hasInputmask.length > 0) {
            $hasInputmask.each(function() {
                $(this).inputmask('remove');
                $(this).inputmask(eval($(this).attr('data-plugin-inputmask')));
            });
        }


        // "kartik-v/yii2-widget-datetimepicker"
        var $hasDateTimepicker = $(widgetOptionsRoot.widgetItem).find('[data-krajee-kvdatetimepicker]');
        if ($hasDateTimepicker.length > 0) {
            $hasDateTimepicker.each(function() {
                $(this).parent().removeData().datetimepicker('remove');
                $(this).parent().datetimepicker(eval($(this).attr('data-krajee-kvdatetimepicker')));
            });
        }

        // "kartik-v/yii2-widget-datepicker"
        var $hasDatepicker = $(widgetOptionsRoot.widgetItem).find('[data-krajee-kvdatepicker]');
        if ($hasDatepicker.length > 0) {
            $hasDatepicker.each(function() {
                $(this).parent().removeData().kvDatepicker('destroy');
                $(this).parent().kvDatepicker(eval($(this).attr('data-krajee-kvdatepicker')));
            });
        }

        // "kartik-v/yii2-widget-timepicker"
        var $hasTimepicker = $(widgetOptionsRoot.widgetItem).find('[data-krajee-timepicker]');
        if ($hasTimepicker.length > 0) {
            $hasTimepicker.each(function() {
                $(this).removeData().off();
                $(this).parent().find('.bootstrap-timepicker-widget').remove();
                $(this).unbind();
                $(this).timepicker(eval($(this).attr('data-krajee-timepicker')));
            });
        }

        // "kartik-v/yii2-money"
        var $hasMaskmoney = $(widgetOptionsRoot.widgetItem).find('[data-krajee-maskMoney]');
        if ($hasMaskmoney.length > 0) {
            $hasMaskmoney.each(function() {
                $(this).parent().find('input').removeData().off();
                var id = '#' + $(this).attr('id');
                var displayID  = id + '-disp';
                $(displayID).maskMoney('destroy');
                $(displayID).maskMoney(eval($(this).attr('data-krajee-maskMoney')));
                $(displayID).maskMoney('mask', parseFloat($(id).val()));
                $(displayID).on('change', function () {
                    var numDecimal = $(displayID).maskMoney('unmasked')[0];
                    $(id).val(numDecimal);
                    $(id).trigger('change');
                });
            });
        }

        // "kartik-v/yii2-widget-fileinput"
        var $hasFileinput = $(widgetOptionsRoot.widgetItem).find('[data-krajee-fileinput]');
        if ($hasFileinput.length > 0) {
            $hasFileinput.each(function() {
                $(this).fileinput(eval($(this).attr('data-krajee-fileinput')));
            });
        }

        // "kartik-v/yii2-widget-touchspin"
        var $hasTouchSpin = $(widgetOptionsRoot.widgetItem).find('[data-krajee-TouchSpin]');
        if ($hasTouchSpin.length > 0) {
            $hasTouchSpin.each(function() {
                $(this).TouchSpin('destroy');
                $(this).TouchSpin(eval($(this).attr('data-krajee-TouchSpin')));
            });
        }
		
		// "kartik-v/yii2-widget-typehead"
        var $hasTypehead = $(widgetOptionsRoot.widgetItem).find('[data-krajee-typeahead]');
        if ($hasTypehead.length > 0) {
            $hasTypehead.each(function() {
				
				$(this).typeahead('destroy');
				var isTemplate = $(this).attr('data-template');
				var emptyText = $(this).attr('data-empty');
				
				var source = new Bloodhound({
				  datumTokenizer: Bloodhound.tokenizers.obj.whitespace($(this).attr('data-display')),
				  queryTokenizer: Bloodhound.tokenizers.whitespace,
				  remote: {
					url: $(this).attr('data-url'),
					wildcard: '%QUERY'
				  }
				});					
				
				if (typeof isTemplate != 'undefined') {
					$(this).typeahead(null, {
					  name: $(this).attr('id'),
					  display: $(this).attr('data-display'),
					  source: source,
					  templates: {
						empty: [
						 emptyText
						],
						suggestion: Handlebars.compile(isTemplate)
					  },				  				  
					});					
				} else {
					$(this).typeahead(null, {
					  name: $(this).attr('id'),
					  display: $(this).attr('data-display'),
					  source: source
					});					
				}	
            });
        }

        // "kartik-v/yii2-widget-colorinput"
        var $hasSpectrum = $(widgetOptionsRoot.widgetItem).find('[data-krajee-spectrum]');
        if ($hasSpectrum.length > 0) {
            $hasSpectrum.each(function() {
                var id = '#' + $(this).attr('id');
                var sourceID  = id + '-source';
                $(sourceID).spectrum('destroy');
                $(sourceID).unbind();
                $(id).unbind();
                var configSpectrum = eval($(this).attr('data-krajee-spectrum'));
                configSpectrum.change = function (color) {
                    jQuery(id).val(color.toString());
                };
                $(sourceID).attr('name', $(sourceID).attr('id'));
                $(sourceID).spectrum(configSpectrum);
                $(sourceID).spectrum('set', jQuery(id).val());
                $(id).on('change', function(){
                    $(sourceID).spectrum('set', jQuery(id).val());
                });
            });
        }

        // "kartik-v/yii2-widget-depdrop"
        var $hasDepdrop = $(widgetOptionsRoot.widgetItem).find('[data-krajee-depdrop]');
        if ($hasDepdrop.length > 0) {
            $hasDepdrop.each(function() {
                if ($(this).data('select2') === undefined) {
                    $(this).removeData().off();
                    $(this).unbind();
                    _restoreKrajeeDepdrop($(this));
                }
            });
        }

        // "kartik-v/yii2-widget-select2"
        var $hasSelect2 = $(widgetOptionsRoot.widgetItem).find('[data-krajee-select2]');
        if ($hasSelect2.length > 0) {
            $hasSelect2.each(function() {
                var id = $(this).attr('id');
                var $id = $('#' + id);
                var configSelect2 = eval($(this).attr('data-krajee-select2'));

                if ($(this).data('select2')) {
                    $(this).select2('destroy');
                }

                var configDepdrop = $(this).data('depdrop');
                if (configDepdrop) {
                    configDepdrop = $.extend(true, {}, configDepdrop);
                    $(this).removeData().off();
                    $(this).unbind();
                    _restoreKrajeeDepdrop($(this));
                }

                var s2LoadingFunc = typeof initSelect2Loading != 'undefined' ? initSelect2Loading : initS2Loading;
                var s2OpenFunc = typeof initSelect2DropStyle != 'undefined' ? initSelect2Loading : initS2Loading;
                $.when($('#' + id).select2(configSelect2)).done(s2LoadingFunc(id, '.select2-container--krajee'));

                var kvClose = 'kv_close_' + id.replace(/\-/g, '_');

                $('#' + id).on('select2:opening', function(ev) {
                    s2OpenFunc(id, kvClose, ev);
                    // $('#' + id).find('.kv-plugin-loading').remove();
                });

                $id.on('select2:unselect', function() {
                    window[kvClose] = true;
                });

                if (configDepdrop) {
                    var loadingText = (configDepdrop.loadingText) ? configDepdrop.loadingText : 'Loading ...';
                    initDepdropS2(id, loadingText);
                }

                $('.kv-plugin-loading').remove();
            });
        }

        // "kartik-v/yii2-checkbox-x"
        var $hasCheckboxX = $(widgetOptionsRoot.widgetItem).find("[data-krajee-checkboxx]");
        if ($hasCheckboxX.length > 0) {
            $hasCheckboxX.each(function () {
                if ($(this).attr("class") == "cbx-loading") {
                    var ckxOptions = eval($(this).attr("data-krajee-checkboxx"));
                    $(this).checkboxX(ckxOptions);
                }
            });
        }
        // }
        //
        // // "kartik-v/yii2-checkbox-x"
        // var $hasCheckboxX = $(this).find('[data-krajee-checkboxx]');
        // if ($hasCheckboxX.length > 0) {
        //     $hasCheckboxX.each(function() {
        //         if ($(this).attr('class') === 'cbx-loading') {
        //             var ckxOptions = eval($(this).attr('data-krajee-checkboxx'));
        //             $(this).checkboxX(ckxOptions);
        //         }
        //     });
        // }
        // "kartik-v/yii2-widget-rating"
        var $hasRating = $(widgetOptionsRoot.widgetItem).find('[data-krajee-rating]');
        if ($hasRating.length > 0) {
            $hasRating.each(function() {
                $(this).rating('destroy');
                $(this).rating(eval($(this).attr('data-krajee-rating')));
            });
        }
    };

})(window.jQuery);
