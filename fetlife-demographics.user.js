/**
 *
 * This is a Greasemonkey script and must be run using Greasemonkey 1.0 or newer.
 *
 * @author maymay <bitetheappleback@gmail.com>
 */
// ==UserScript==
// @name           FetLife Demographics
// @version        0.1
// @namespace      com.maybemaimed.fetlife.demographics
// @updateURL      https://userscripts.org/scripts/source/151628.user.js
// @description    Displays the demographics of FetLife events by age, sex, and role. May help you quickly determine whether an event is worth participating in or not.
// @include        https://fetlife.com/events/*
// @exclude        https://fetlife.com/events/*/*
// @grant          GM_xmlhttpRequest
// @grant          GM_addStyle
// @grant          GM_log
// ==/UserScript==

FL_ASL = {}; // We'll need some stock code from FetLife ASL Search.
FL_DEMOGRAPHICS = {};
FL_DEMOGRAPHICS.CONFIG = {
    'debug': false, // switch to true to debug.
};

FL_DEMOGRAPHICS.users       = {}; // stores our collected totals
FL_DEMOGRAPHICS.users.ages  = {}; // stores our collected totals by age
FL_DEMOGRAPHICS.users.sexes = {}; // stores our collected totals by sexes
FL_DEMOGRAPHICS.users.roles = {}; // stores our collected totals by roles

// Utility debugging function.
FL_DEMOGRAPHICS.log = function (msg) {
    if (!FL_DEMOGRAPHICS.CONFIG.debug) { return; }
    GM_log('FETLIFE DEMOGRAPHICS: ' + msg);
};

// Initializations.
var uw = (unsafeWindow) ? unsafeWindow : window ; // Help with Chrome compatibility?
GM_addStyle('\
/* Hide ages for now. */\
#fl-demographics-ages { display: none; }\
.fl-demographics-list { text-transform: capitalize; }\
.fl-demographics-list * { text-transform: none; }\
#fl-demographics-container ul ul ul {\
    display: none;\
    list-style: none;\
}\
');
FL_DEMOGRAPHICS.init = function () {
    FL_DEMOGRAPHICS.main();
};
window.addEventListener('DOMContentLoaded', FL_DEMOGRAPHICS.init);

// @see "FetLife Age/Sex/Location Search" #getKinkstersFromURL
FL_DEMOGRAPHICS.getKinkstersFromURL = function (url) {
    FL_DEMOGRAPHICS.log('Getting Kinksters list from URL: ' + url);
    GM_xmlhttpRequest({
        'method': 'GET',
        'url': url,
        'onload': function (response) {
            var parser = new DOMParser();
            var doc = parser.parseFromString(response.responseText, 'text/html');
            var els = doc.querySelectorAll('.user_in_list');

            result_count = 0;
            for (var i = 0; i < els.length; i++) {
                // Parse results for this page and make note of each demographic.
                // TODO: Tag source ("yes" or "maybe" RSVP) to sort later.
                // FIXME: This should actually be filtered elsewhere.
                var rsvp_type = (response.finalUrl.match(/maybe$/)) ? 'maybe' : 'yes';
                FL_DEMOGRAPHICS.parseUserInList(els[i]);
                result_count++;
            }

            // Set up next request.
            my_page = (url.match(/\d+$/)) ? parseInt(url.match(/\d+$/)[0]) : 1 ;
            next_page = my_page + 1;
            if (next_page > 2) {
                next_url = url.replace(/\d+$/, next_page.toString());
            } else {
                next_url = url + '?page=' + next_page.toString();
            }

            // No pagination? This is the end.
            if (!doc.querySelector('.pagination')) {
                // We're done paginating, so this was the last page.
                FL_DEMOGRAPHICS.log('Done after searching ' + response.finalUrl)
                FL_DEMOGRAPHICS.displayTotals();
            } else if (!doc.querySelector('.pagination .next_page.disabled')) {
                // Automatically search on next page if not end of pagination.
                FL_DEMOGRAPHICS.getKinkstersFromURL(next_url);
                return false;
            } else {
                // We're done paginating, so this was the last page.
                FL_DEMOGRAPHICS.log('Done after searching ' + response.finalUrl)
                FL_DEMOGRAPHICS.displayTotals();
            }
        }
    });
};

FL_DEMOGRAPHICS.parseUserInList = function (el, rsvp_type) {
    var sex  = FL_ASL.getSex(el);
    var age  = FL_ASL.getAge(el);
    var role = FL_ASL.getRole(el);

    // Record this user under demographic of their sex.
    if (FL_DEMOGRAPHICS.users.sexes[sex]) {
        FL_DEMOGRAPHICS.users.sexes[sex].push({
            'html' : el,
            'rsvp' : rsvp_type
        });
    } else {
        FL_DEMOGRAPHICS.users.sexes[sex] = [{
            'html' : el,
            'rsvp' : rsvp_type
        }];
    }

    // Record this user under demographic of their age.
    if (FL_DEMOGRAPHICS.users.ages[age]) {
        FL_DEMOGRAPHICS.users.ages[age].push({
            'html' : el,
            'rsvp' : rsvp_type
        });
    } else {
        FL_DEMOGRAPHICS.users.ages[age] = [{
            'html' : el,
            'rsvp' : rsvp_type
        }];
    }

    // Record this user under demographic of their role.
    if (FL_DEMOGRAPHICS.users.roles[role]) {
        FL_DEMOGRAPHICS.users.roles[role].push({
            'html' : el,
            'rsvp' : rsvp_type
        });
    } else {
        FL_DEMOGRAPHICS.users.roles[role] = [{
            'html' : el,
            'rsvp' : rsvp_type
        }];
    }
};

FL_DEMOGRAPHICS.displayTotals = function () {
    var x = document.getElementById('fl-demographics-loading');
    x.parentNode.removeChild(x);
    var div = document.getElementById('fl-demographics-container');
    var ul = document.createElement('ul');
    var html_string = '';
    for (var key in FL_DEMOGRAPHICS.users) {
        html_string += '<li id="fl-demographics-' + key + '" class="fl-demographics-list">' + key + '<ul>';
        for (var v in FL_DEMOGRAPHICS.users[key]) {
            html_string += '<li>' + FL_DEMOGRAPHICS.users[key][v].length + ' ' + v + ' (<a href="#" class="fl-demographics-show-list">show</a>)<ul>';
            for (var x in FL_DEMOGRAPHICS.users[key][v]) {
                html_string += '<li>' + FL_DEMOGRAPHICS.users[key][v][x].html.outerHTML + '</li>';
            }
            html_string += '</ul></li>';
        }
        html_string += '</ul></li>';
    }
    ul.innerHTML = html_string;

    div.appendChild(ul);

    // Attach event handlers.
    var els = document.querySelectorAll('.fl-demographics-show-list');
    for (var i = 0; i < els.length; i++) {
        els[i].addEventListener('click', FL_DEMOGRAPHICS.toggleShowHideList);
    }
};

FL_DEMOGRAPHICS.toggleShowHideList = function (e) {
    e.preventDefault();
    var ul = e.target.nextElementSibling;
    var me = e.target.childNodes[0];
    if (ul.style.display === 'block') {
        ul.style.display = 'none';
    } else {
        ul.style.display = 'block';
    }
    if (me.nodeValue === 'show') {
        me.nodeValue = 'hide';
    } else {
        me.nodeValue = 'show';
    }
    return false;
};

// @see FetLife Age/Sex/Location
FL_ASL.getSex = function (el) {
    var x = el.querySelector('.quiet').innerHTML;
    var sex = x.match(/^\d\d(\S*)/);
    return sex[1];
};

FL_ASL.getAge = function (el) {
    var x = el.querySelector('.quiet').innerHTML;
    var age = x.match(/^\d\d/);
    return parseInt(age);
};

FL_ASL.getRole = function (el) {
    var x = el.querySelector('.quiet').innerHTML;
    var role = x.match(/ ?(\S+)?$/);
    return role[1];
};

FL_DEMOGRAPHICS.getKinkstersGoing = function (event, page) {
    var url = 'https://fetlife.com/events/' + event.toString() + '/rsvps';
    url = (page) ? url + '?page=' + page.toString() : url ;
    FL_DEMOGRAPHICS.getKinkstersFromURL(url);
};
FL_DEMOGRAPHICS.getKinkstersMaybeGoing = function (event, page) {
    var url = 'https://fetlife.com/events/' + event.toString() + '/rsvps/maybe';
    url = (page) ? url + '?page=' + page.toString() : url ;
    FL_DEMOGRAPHICS.getKinkstersFromURL(url);
};

// This is the main() function, executed on page load.
FL_DEMOGRAPHICS.main = function () {
    // What event is this?
    var eid = window.location.href.match(/^https:\/\/fetlife.com\/events\/(\d+)/);
    if (!eid) { // this isn't an event page, so bail early.
        FL_DEMOGRAPHICS.log('No event ID found in URL: ' + window.location.href);
        return;
    }

    var td = document.querySelector('table.mbxxl td');
    var div = document.createElement('div');
    div.setAttribute('id', 'fl-demographics-container');
    div.innerHTML = 'Demographics:<div id="fl-demographics-loading">Loading&hellip;</div>';
    td.appendChild(div);

    // Get the list of "yes" and "maybe" RSVPs
    var rsvp_yes   = FL_DEMOGRAPHICS.getKinkstersGoing(eid[1]);
//    var rsvp_maybe = FL_DEMOGRAPHICS.getKinkstersMaybeGoing(eid[1]);
};
