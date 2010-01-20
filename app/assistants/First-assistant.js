/*jslint white: false, onevar: false, plusplus: false */
/*global $L Mojo Ajax Base64 */
function FirstAssistant() {
    /* this is the creator function for your scene assistant object. It will be passed all the
       additional parameters (after the scene name) that were passed to pushScene. The reference
       to the scene controller (this.controller) has not be established yet, so any initialization
       that needs the scene controller should be done in the setup function below. */
}

FirstAssistant.prototype.setup = function() {
    /* this function is for setup tasks that have to happen when the scene is first created */

    /* use Mojo.View.render to render view templates and add them to the scene, if needed. */

    /* setup widgets here */

    /* add event handlers to listen to events from widgets */

    // a local object for widget attributes
    this.widgets = {
        sync_now: {
            attributes: {},
            model: {
                label: $L( 'Refresh Now' ),
                buttonClass: '',
                disabled: false
            },
            event: {
                type: Mojo.Event.tap,
                method: 'syncNow'
            }
        },
        pim_file: {
            attributes: {
                hintText: null,
                multiline: false,
                enterSubmits: false,
                textReplacement: false,
                focus: true
            },
            model: {
                value: 'http://yourserver/pim.json',
                disabled: false
            }
        },
        username: {
            attributes: {
                hintText: null,
                multiline: false,
                enterSubmits: false,
                textReplacement: false,
                focus: false
            },
            model: {
                value: '',
                disabled: false
            }
        },
        password: {
            attributes: {
                hintText: null,
                multiline: false,
                enterSubmits: false,
                textReplacement: false,
                focus: false
            },
            model: {
                value: '',
                disabled: false
            }
        }
    };

    var settings = new Mojo.Model.Cookie( 'settings' ).get();

    if (typeof settings === 'undefined') {
        this.createProfile();
    }

    for (var b in this.widgets) {
        if (this.widgets.hasOwnProperty( b )) {
            Mojo.Log.info( '%j', b );

            if (settings && settings[ b ]) {
                this.widgets[ b ].model.value = settings[ b ];
            }

            // set up widgets
            this.controller.setupWidget( b, this.widgets[ b ].attributes, this.widgets[ b ].model );

            if (typeof this.widgets[ b ].event === 'object') {
                Mojo.Log.info( '%j', this.widgets[ b ].event );

                // bind widgets to their handler
                Mojo.Event.listen(
                    this.controller.get( b ),
                    this.widgets[ b ].event.type,
                    this[ this.widgets[ b ].event.method ].bind( this )
                );
            }
        }
    }

};

FirstAssistant.prototype.activate = function(event) {
    /* put in event handlers here that should only be in effect when this scene is active. For
       example, key handlers that are observing the document */
};


FirstAssistant.prototype.deactivate = function(event) {
    /* remove any event handlers you added in activate and do any other cleanup that should happen before
       this scene is popped or another scene is pushed on top */
};

FirstAssistant.prototype.cleanup = function(event) {
    /* this function should do any cleanup needed before the scene is destroyed as
       a result of being popped off the scene stack */
};

FirstAssistant.prototype.createProfile = function() {
    Mojo.Log.info( 'before service creation' );

    Mojo.Log.info( '%j', Mojo.appPath );

    this.controller.serviceRequest( 'palm://com.palm.accounts/crud', {
        method: 'createAccount',
        parameters: {
            displayName: 'PrivateSync',
            username: 'me',
            domain: 'myself',
            icons: {'48x48': Mojo.appPath + 'images/icon48.png', '32x32': Mojo.appPath + 'images/icon32.png'},
            dataTypes: ['CONTACTS', 'CALENDAR'],
            isDataReadOnly: false
        },
        onSuccess: this.profileCreated.bind( this ),
        onFailure: function( response )  {
            Mojo.Log.info( 'Account creation failed' );
            Mojo.Log.info( '%j', response );

            Mojo.Controller.errorDialog( $L( 'The account could not be created for an unknown reason. Sorry!' ) );
        }
    } );

    Mojo.Log.info( 'after service creation' );
};

FirstAssistant.prototype.profileCreated = function( response ) {
    Mojo.Log.info( 'Account creation succeeded' );
    Mojo.Log.info( '%j', response );

    var cookie = new Mojo.Model.Cookie( 'settings' );
    cookie.put( {profile: response} );

    this.controller.serviceRequest( 'palm://com.palm.calendar/crud', {
        method: 'createCalendar',
        parameters: {
            accountId: response.accountId,
            calendar: {
                calendarId: '',
                name: 'PrivateSync'
            }
        },
        onSuccess: this.calendarCreated.bind( this ),
        onFailure: function( response ) {
            Mojo.Log.info( 'Calendar creation failed' );
            Mojo.Log.info( '%j', response );

            Mojo.Controller.errorDialog( $L( 'The account calendar could not be created for an unknown reason. Sorry!' ) );
        }
    } );
};

FirstAssistant.prototype.calendarCreated = function( response ) {
    this.controller.showAlertDialog( {
        title: $L( 'Account Created' ),
        message: $L( 'Your PrivateSync account was created successfully!' ),
        choices: [
            { label: $L( 'OK' ), value: 'OK', type: 'affirmative' }
        ]
    } );
};

FirstAssistant.prototype.syncNow = function( event ) {
    var cookie = new Mojo.Model.Cookie( 'settings' );
    var settings = cookie.get();
    var uri = this.widgets.pim_file.model.value;
    var username = this.widgets.username.model.value;
    var password = this.widgets.password.model.value;

    settings.pim_file = uri;
    settings.username = username;
    settings.password = password;
    cookie.put( settings );

    var req = new Ajax.Request( uri, {
        method: 'get',
        requestHeaders: {
            'Authorization': 'Basic ' + Base64.encode( username + ':' + password )
        },
        onSuccess: this.refreshPim.bind( this ),
        onFailure: function() {
            Mojo.Controller.errorDialog( $L( 'Server communication error. Please check your settings and server setup!' ) );
        }
    } );
};

FirstAssistant.prototype.refreshPim = function( response ) {
    var data = response.responseJSON;
    var profile = new Mojo.Model.Cookie( 'settings' ).get().profile;
    var i;
    var t = this;

    Mojo.Log.info( 'refresh' );

    if (typeof data !== 'object') {
        Mojo.Controller.errorDialog( $L( 'Did not retrieve JSON data. Make sure, the PIM file provided contains only valid JSON encoded data!' ) );
        return;
    }

    if (typeof data.contacts === 'object') {
        this.controller.serviceRequest( 'palm://com.palm.contacts/crud', {
            method: 'listContacts',
            parameters: {
                accountId: profile.accountId,
                offset: 0,
                limit: 2147483647
            },
            onSuccess: function( result ) {
                var i;

                Mojo.Log.info( 'list success' );
                Mojo.Log.info( '%j', result );

                for (i = 0; i < result.list.length; i++) {
                    t.controller.serviceRequest( 'palm://com.palm.contacts/crud', {
                        method: 'deleteContact',
                        parameters: {
                            accountId: profile.accountId,
                            id: result.list[ i ].id
                        }
                    } );
                }

                for (i = 0; i < data.contacts.length; i++) {
                    t.controller.serviceRequest( 'palm://com.palm.contacts/crud', {
                        method: 'createContact',
                        parameters: {
                            accountId: profile.accountId,
                            contact: data.contacts[ i ]
                        },
                        onSuccess: function( result ) {
                            Mojo.Log.info( 'create success' );
                            Mojo.Log.info( '%j', result );
                        },
                        onFailure: function( result ) {
                            Mojo.Log.info( 'create failure' );
                            Mojo.Log.info( '%j', result );
                        }
                    } );
                }
            },
            onFailure: function() {}
        } );
    }
};