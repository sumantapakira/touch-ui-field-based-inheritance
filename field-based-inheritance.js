/*###############################################################################
# Copyright 2020 Sumanta Pakira
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
###############################################################################*/
(function ($, $document) {
    "use strict";

    window.MyOrg = window.MyOrg || {};

    $document.on("dialog-ready", function () {
        createMSMLock();
    });

    $(document).off("click.custom-property-inheritance")
        .on("click.custom-property-inheritance", ".custom-property-inheritance", function (e) {

            var activator = $(this);
            var inheritanceLockedStatus = activator.data("inheritance-locked-status");

            var modalMessage = inheritanceLockedStatus ?
                               Granite.I18n.get("Do you really want to cancel the inheritance?") :
                               Granite.I18n.get("Do you really want to revert the inheritance?");

            var togglePropertyName = activator.data("toggle-property-inheritance");
            var params = {};
            params['msm:propertyName'] = togglePropertyName;
            params['cmd'] = inheritanceLockedStatus ? 'reenablePropertyInheritance' : 'cancelPropertyInheritance';

    if(Granite.author.DialogFrame.currentDialog.editable.path){
            $.ajax({
                       type: "POST",
                       url: Granite.author.DialogFrame.currentDialog.editable.path + ".touchuimsm.conf",
                       data: params
                   }).always(function () {
                createMSMLock();

            });
         }

        });

    function isCancelled(pagePropertiesData, lockableName) {
        var cancelledProperties = pagePropertiesData['cq:propertyInheritanceCancelled'];
        var isCancelled = false;
        var isCancelledForDialog = pagePropertiesData['cq:isCancelledForChildren'];

        if(isCancelledForDialog){
				isCancelled = true;
        }else{
        if (lockableName[0] !== '/') {
            isCancelled = $.inArray(lockableName, cancelledProperties) >= 0;
        } else {
            lockableName = lockableName.substring(1);

            var nodeData = pagePropertiesData[lockableName];
            isCancelled = nodeData && nodeData["jcr:mixinTypes"] &&
                          $.inArray("cq:LiveSyncCancelled", nodeData["jcr:mixinTypes"]) >= 0
         }
        }

        return isCancelled;
    }

    function isManuallyCreated() {
        var isManuallyCreated = false;
        if (Granite.author.pageInfo.msm["msm:isLiveCopy"]) {
            var editable = Granite.author.DialogFrame.currentDialog.editable;
            if (editable) {
                var nodeData = Granite.HTTP.eval(editable.path + ".json");
                if (nodeData) {
                    //var mixin =  node.jcr:mixinTypes;
                    if ($.inArray("cq:LiveRelationship", nodeData["jcr:mixinTypes"]) !== -1) {
                        isManuallyCreated = false;
                    } else {
                        isManuallyCreated = true;
                    }

                }
            }
        } else {
            isManuallyCreated = true;
        }
        return isManuallyCreated;
    }

    function getLinkElement(lockableName, inheritanceLocked) {
        return $("<a/>", {
            "class": "cq-msm-property-toggle-inheritance custom-property-inheritance",
            "data-toggle-property-inheritance": lockableName,
            "data-inheritance-locked-status": inheritanceLocked,
            // rollout sync happens on the page itself, not on the page content node
            "data-path": "/content/abc",
            "data-sourcepath": "/content/xyz",
            "title": inheritanceLocked ?
                     Granite.I18n.get("Revert inheritance") :
                     Granite.I18n.get("Cancel inheritance"),
            href: "#"
        });

    }

    function createMSMLock() {

        var liveCopyPage = isManuallyCreated();
        if (!liveCopyPage && Granite.author.DialogFrame.currentDialog.editable) {
            $.ajax({
                       type: "GET",
                       url: Granite.author.DialogFrame.currentDialog.editable.path + ".1.json",
                       traditional: true,
                       cache: false
                   })
                .done(function (pagePropertiesData) {

                    $.each($("[data-cq-msm-lockable]"), function (idx, lockableField) {

                        var fieldAPI = $(this).adaptTo("foundation-field");
                        var $richText = lockableField.closest(".cq-RichText");

                        var richTextParent;
                        var $richTextImmediateParent;
                        if ($richText) {
                            richTextParent = $(lockableField).parent().parent();
                            $richTextImmediateParent = $(lockableField).parent();
                        }

                        var fieldWrapper = $(lockableField).parents(".coral-Form-fieldwrapper");
                        if (fieldWrapper.length === 0) {
                            fieldWrapper = $(lockableField).parents(".foundation-field-edit");
                        }

                        var lockableName = $(lockableField).data("cq-msm-lockable");

                        //replace any leading ./
                        lockableName = lockableName.replace(/^.\//g, "");

                        var inheritanceLocked = true;

                        var childField = fieldWrapper.find(".coral-Form-field");
                        if (childField.length === 0) {
                            childField = fieldWrapper.children().not(".cq-msm-property-toggle-inheritance");
                        }
                        childField.addClass("cq-msm-lockable-field");

                        var canceled = isCancelled(pagePropertiesData, lockableName);
                        var lockIcon = "link";
                        var disabled = true;
                        if (!canceled) {
                            lockIcon = "link";
                            inheritanceLocked = false;
                            disabled = true;
                        } else {
                            lockIcon = "linkOff";
                            inheritanceLocked = true;
                            disabled = false;
                        }

                        if (fieldAPI && fieldAPI.setDisabled) {
                            fieldAPI.setDisabled(disabled);
                            if (disabled) {
                                childField.find(":input").not("[disabled]").attr("disabled", true);
                            } else {
                                childField.removeAttr("disabled");
                                childField.find(":input").attr("disabled", false);
                            }
                        } else {
                            childField.attr("disabled", disabled);
                        }
                        childField.find("button[is=coral-button]").each(function () {
                            this.disabled = disabled;
                        });
                        childField.find("a[is=coral-anchorbutton]").each(function () {
                            this.disabled = disabled;
                        });

                        if (disabled && $richText) {
                            $richTextImmediateParent.css("pointer-events", "none");
                            $richTextImmediateParent.css("background-color", "#dbdbdb");
                        } else if ($richText && !disabled) {
                            $richTextImmediateParent.css("pointer-events", "auto");
                            $richTextImmediateParent.css("background-color", "#ffffff");
                        }

                        var link;
                        if ($richText) {
                            link = richTextParent.find(".cq-msm-property-toggle-inheritance");
                        } else {
                            link = fieldWrapper.find(".cq-msm-property-toggle-inheritance");
                        }

                        if (link.length === 0) {

                            if ($richText) {
                                var toggle = richTextParent.find(".cq-msm-property-toggle-inheritance").length;

                                if (toggle === 0) {
                                    link = getLinkElement(lockableName, inheritanceLocked).insertAfter($richText);
                                }

                            } else {
                                var $insertPlace;
                                if (childField[childField.length - 1]) {
                                    $insertPlace = childField[0].tagName.toLowerCase() === 'coral-multifield' ? childField[0] : childField[childField.length - 1];
                                    link = getLinkElement(lockableName, inheritanceLocked).insertAfter($insertPlace);
                                } else {

                                    // dirty hack for the 'checkbox' field, in case checkbox does not have desc or
                                    // renderOnly props, the field is not wrapped with `coral-Form-fieldwrapper` div
                                    // therefore we should wrap it manually (todo refactor)
                                    if (childField.context.tagName === "CORAL-CHECKBOX") {
                                        var $coralCheckbox = $(childField.context);
                                        $coralCheckbox.css({'width': '94%', 'display': 'inline-block'});
                                        $coralCheckbox.wrap("<div class='coral-Form-fieldwrapper'></div>");
                                        link = getLinkElement(lockableName, inheritanceLocked);
                                        $(childField.context.parentElement).append(link);
                                    } else {
                                        $insertPlace = childField;
                                        console.log($insertPlace.closest(".coral3-Multifield"));
                                        link = $insertPlace.append("<p>dsdd</p>");
                                    }
                                }

                            }

                            var $icon = $("<coral-icon/>", {
                                "icon": lockIcon,
                                "size": "S"
                            }).appendTo(link);

                            //search for a field info
                            var fieldInfo = fieldWrapper.find(".coral-Form-fieldinfo");
                            var outerWidth = childField.filter(':not(coral-multifield)').outerWidth();
                            if (fieldInfo.length > 0 &&
                                outerWidth > 0 &&
                                childField.filter(':not(coral-multifield)').css("width").indexOf("%") < 0) {
                                // shrink the field
                                childField.filter(':not(coral-multifield)').css({
                                                   "width": outerWidth - $icon.outerWidth()
                                               });
                            }
                        } else {
                            link.data("inheritance-locked-status", inheritanceLocked);
                            var $icon = link.find("coral-icon");
                            if ($icon.length > 0) {
                                $icon[0].icon = lockIcon;
                            }
                            if (inheritanceLocked) {

                                var fieldValue;
                                if (lockableName[0] === '/') {
                                    //only case of /subnode/propertyName is covered
                                    fieldValue =
                                        pagePropertiesData[lockableName.substring(1)]
                                        ? pagePropertiesData[lockableName.substring(1)] : "";
                                    var childFieldPropertyName = childField.attr('name');
                                    if (childFieldPropertyName) {
                                        //remove leading ./ and lockableName
                                        childFieldPropertyName =
                                            childFieldPropertyName.replace(/^.\//g, "")
                                                .replace(lockableName.substring(1), "").replace(/^\//, "");
                                        if (fieldValue[childFieldPropertyName]) {

                                            childField.val(fieldValue[childFieldPropertyName]);

                                        }
                                    }

                                } else {
                                    fieldValue =
                                        pagePropertiesData[lockableName] ? pagePropertiesData[lockableName] : "";
                                    if (fieldAPI) {
                                        if (!fieldValue && fieldAPI.clear) {
                                            fieldAPI.clear();
                                        } else {
                                            if (Array.isArray(fieldValue) && fieldAPI.setValues) {
                                                fieldAPI.setValues(fieldValue);
                                            } else if (fieldValue instanceof Object) {
                                                // ignore for now. See CQ-109225.
                                            } else if (fieldAPI.setValue) {
                                                if (lockableField.type === 'datetime') {
                                                    fieldValue = lockableField.value;
                                                }
                                                fieldAPI.setValue(fieldValue);
                                            }
                                        }
                                    } else {
                                        childField.val(fieldValue);
                                    }
                                }
                            }
                        }

                    });
                    // TODO: find a better solution for the problem that hidden field can't store string array values
                    //       and are breaking the inheritance in case they have multiple values for jcr:mixinTypes
                    $('input:hidden[name*="jcr:mixinTypes"]').prop( "disabled", true);
                });
        }

    }

})($, $(document));
