By default AEM Touch UI interface does not give option for field based inheritance in Dialog property as Classic UI.

This is a problem when you do cancel inhitance then as an author you have to cancel whole dialog, there is no possibility to cancel only the property you want to cancel
inheritance.

This code example helps you to achive this.  
You have to add granite:data node under the property node of your dialog and then add a string type property "cq-msm-lockable" and value will the name of your property.
