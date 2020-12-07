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

(function($, ns, channel, window, undefined) {
    "use strict";


    var EditorFrame = ns.EditorFrame;

    var ACTION_ICON = "coral-Icon--alert";
    var ACTION_TITLE = "Dialog Property Changed";
    var ACTION_NAME = "PropertyInheritance";
    var ACTION_NAME_OPEN_DIALOG = "OpenDialog";


        var openDialog = {
        icon: 'coral-Icon--wrench',
        text: 'Open Dialog',
        order: "before COPY",
        handler: function (editable, param, target) {
            Granite.author.DialogFrame.openDialog(new Granite.author.edit.Dialog(editable));
        },
        condition: function(editable) {
            if (ns.EditorFrame && ns.EditorFrame.editableToolbar) {
            	     var isMSMCancelled = editable.config['msm:liveRelationship']['msm:status']['msm:isCancelled'];
                 var isAllowed;

                if($.inArray("EDIT", editable.config.editConfig.actions) !== -1){
                    if(isMSMCancelled && isLiveCopyPage()){
                         isAllowed = false;
                        }else if(!isManuallyCreated(editable.config.path) && isLiveCopyPage()){
                         isAllowed = true;
                        }
                }else{
                    isAllowed = false;
                }
                 return isAllowed;
            }

        },
        isNonMulti: true
    };


    function isManuallyCreated(path) {
        var isManuallyCreated = false;
        if (Granite.author.pageInfo.msm["msm:isLiveCopy"]) {
            if (path) {
                var nodeData = Granite.HTTP.eval(path + ".json");
                if (nodeData) {
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


    var dialogPropChange = new ns.ui.ToolbarAction({
        name: ACTION_NAME,
        icon: ACTION_ICON,
        text: ACTION_TITLE,
        execute: function(editable) {

        },
        condition: function(editable) {
            if (ns.EditorFrame && ns.EditorFrame.editableToolbar) {
                var isAllowed = isInheritanceCancelled(editable);
                return isAllowed;
            }

        },
        isNonMulti: true
    });


    /**
     *
     * Hooks
     *
     */

    // When the Edit Layer gets activated
    channel.on("cq-layer-activated", function(event) {
        if (event.layer === "Edit") {
            if (isLiveCopyPage()) {
                EditorFrame.editableToolbar.registerAction(ACTION_NAME, dialogPropChange);
                EditorFrame.editableToolbar.registerAction(ACTION_NAME_OPEN_DIALOG, openDialog);
            }
        }
});


    function isInheritanceCancelled(editable) {
        var isCancelled = false;
        var cancelledProperties = editable.config['msm:liveRelationship']['msm:status']['msm:cancelledProperties'];

        if (cancelledProperties.length !== 0) {
            isCancelled = true;
        }
        return isCancelled;
    }

    function isLiveCopyPage() {
        return Granite.author.pageInfo.msm["msm:isLiveCopy"];
    }


}(jQuery, Granite.author, jQuery(document), this));
