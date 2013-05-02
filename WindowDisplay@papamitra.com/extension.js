
const Clutter = imports.gi.Clutter;
const Main = imports.ui.main;
const Search = imports.ui.search;
const AppDisplay = imports.ui.appDisplay;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Shell = imports.gi.Shell;
const Meta = imports.gi.Meta;
const Params = imports.misc.params;
const Lang = imports.lang;
const IconGrid = imports.ui.iconGrid;

const St = imports.gi.St;

var windowSearchProvider = null;

const WindowSearchIcon = new Lang.Class({
    Name: 'WindowSearchIcon',

    _init: function(win, name) {
        this._win = win;
        this.actor = new St.Bin({ reactive: true,
                                  track_hover: true });
        this.icon = new IconGrid.BaseIcon(name,
                                          { showLabel: true,
                                            createIcon: Lang.bind(this, this.createIcon) } );
        this.actor.child = this.icon.actor;
        this.actor.label_actor = this.icon.label;
    },

    createIcon: function (size) {
	let mutterWindow = this._win.get_compositor_private();
	if (!mutterWindow)
	    return null;

        let windowTexture = mutterWindow.get_texture ();
	let [width, height] = windowTexture.get_size();
	let scale = Math.min(1.0, size / width, size / height);

	let clone = new Clutter.Clone ({ source: windowTexture,
					 reactive: true,
                                         width: width * scale,
                                         height: height * scale });

        let group = new Clutter.Group();

	let clonebin = new St.Bin();
	clonebin.add_actor(clone);
	clonebin.set_position( (size-(width*scale))/2,
			       (size-(height*scale))/2);
	group.add_actor(clonebin);

	// add appicon
        let tracker = Shell.WindowTracker.get_default();
	let app = tracker.get_window_app(this._win);
	let icon = app.create_icon_texture(size/3);
	let iconbin = new St.Bin();
	iconbin.set_opacity(200);
	iconbin.add_actor(icon);
	iconbin.set_position(size-size/3,size-size/3);
	group.add_actor(iconbin);

	return group;
    }

});

const WindowSearchProvider = new Lang.Class({
    Name: 'WindowSearchProvider',

    _init: function() {
        this.id = 'windowSearch';
    },

    getResultMetas: function(ids, callback) {
        let metas = ids.map(this.getResultMeta, this);
        callback(metas);
    },

    getResultMeta: function(win) {
	let tracker = Shell.WindowTracker.get_default();
	let app = tracker.get_window_app(win);
        return { 'id': win,
                 'name': app.get_name() + ' - ' + win.get_title()
               };
    },

    createResultActor: function(result, terms) {
        let icon = new WindowSearchIcon(result.id, result.name);
        return icon.actor;
    },

    _matchTerms: function(wins, terms){
        let tracker = Shell.WindowTracker.get_default();
	for (let i = 0; i < terms.length; i++) {
	    let term = terms[i].toUpperCase();
	    wins = wins.filter(function(win){
			       let name = tracker.get_window_app(win).get_name();
			       let title = win.get_title();
			       return  (name.toUpperCase().indexOf(term) >= 0 ||
					title.toUpperCase().indexOf(term) >= 0);
			   });
        }
	return wins;
    },

    getInitialResultSet: function(terms) {
        let screen = global.screen;
        let display = screen.get_display();
	let windows = [];
	for(let i=0; i < screen.n_workspaces; i++){
	    windows = windows.concat(
		display.get_tab_list(Meta.TabList.NORMAL,
				     screen,
				     screen.get_workspace_by_index(i)));
	}

        let results = this._matchTerms(windows, terms);
        this.searchSystem.pushResults(this, results);
    },

    getSubsearchResultSet: function(previousResults, terms) {
        let results = this._matchTerms(previousResults, terms);
        this.searchSystem.pushResults(this, results);
    },

    activateResult: function(win, params) {
	let tracker = Shell.WindowTracker.get_default();
        // params = Params.parse(params, { workspace: -1,
        //                                timestamp: 0 });

        tracker.get_window_app(win).activate_window(win, global.get_current_time());
    },

});

function init(meta) {
}

function enable() {
    if(windowSearchProvider==null) {
	windowSearchProvider = new WindowSearchProvider();	    
	Main.overview.addSearchProvider(windowSearchProvider);	
    }
}

function disable() {
    if(windowSearchProvider!=null) {
	Main.overview.removeSearchProvider(windowSearchProvider);
	windowSearchProvider = null;
    }
}
