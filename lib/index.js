/*
 * KeepMyDiscoverWeekly
 * Copyright (C) 2018 Dogboy21
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

const express = require('express'),
    exphbs  = require('express-handlebars'),
    querystring = require('querystring'),
    cookieParser = require('cookie-parser'),
    crypto = require('crypto'),
    config = require('../config.json'),
    utils = require('./utils'),
    spotify = require('./spotify'),
    db = require('./database');

function checkPlaylist(accessToken, playlistId, oldChecksum, cb) {
    spotify.getPlaylistTracks(accessToken, playlistId, (err, response) => {
        if (err) {
            return cb(err);
        }

        let addedAt = "";
        let tracks = [];
        for (let i = 0; i < response.items.length; i++) {
            let track = response.items[i];
            tracks.push(track.track.uri);
            addedAt = track.added_at;
        }

        let trackString = tracks.join();
        let checksum = crypto.createHash('sha256').update(trackString).digest('hex');

        if (oldChecksum !== checksum) {
            db.insertPlaylistCheck(playlistId, checksum);

            let date = new Date(addedAt);
            let firstJanuary = new Date(date.getFullYear(), 0, 1);
            let week = Math.ceil( (((date - firstJanuary) / 86400000) + firstJanuary.getDay() + 1) / 7 );

            spotify.createPlaylist(accessToken, 'Archived Discover Weekly ' + date.getFullYear() + '-' + week, (err, response) => {
                if (err) {
                    return cb(err);
                }

                spotify.addTracks(accessToken, response.tracks.href, trackString, (err) => {
                    if (err) {
                        return cb(err);
                    }

                    return cb(false, true);
                })
            });
        } else {
            return cb(false, false);
        }
    });
}

function householding() {
    console.log('Starting householding task');
    db.getPlaylistsToUpdate((err, playlists) => {
        if (err) {
            console.error('An error occured during householding task', err);
            return;
        }

        if (playlists.length === 0) {
            console.log('Householding finished, no playlists to check');
            return;
        }

        for (let i = 0; i < playlists.length; i++) {
            (function(index) {
                let playlist = playlists[index];

                let checker = (function() {
                    checkPlaylist(playlist.token, playlist.id, playlist.checksum, (err, created) => {
                        if (err) {
                            console.error('Failed to check playlist state during householding task', err);
                            return;
                        }

                        if (created) {
                            console.log('Archived playlist ' + playlist.id);
                        }

                        if (index === (playlists.length - 1)) {
                            console.log('Householding finished');
                        }
                    });
                });

                if (playlist.tokenExpiry < Date.now()) {
                    spotify.refreshToken(playlist.refreshToken, (err, response) => {
                        if (err) {
                            return console.error('Failed to check playlist state during householding task', err);
                        }

                        playlist.token = response.access_token;

                        db.setToken(response.access_token, playlist.refreshToken, response.expires_in, (err) => {
                            if (err) {
                                return console.error('Failed to check playlist state during householding task', err);
                            }

                            checker();
                        })
                    });
                } else {
                    checker();
                }


            })(i);
        }
    });
}

const app = express();
app.engine('handlebars', exphbs({defaultLayout: 'main'}));
app.set('view engine', 'handlebars');
app.use(cookieParser(config.cookieSecret));
app.use(express.static(__dirname + '/../public'));

app.get('/', (req, res) => {
    if (req.signedCookies.token) {
        return res.redirect('/config');
    }

    return res.render('index');
});

app.get('/unauthorized', (req, res) => {
    return utils.errorPage(res, 'The login process didn\'t succeed');
});

app.get('/config', (req, res) => {
    if (!req.signedCookies.token) {
        return res.redirect('/');
    }

    let accessToken = req.signedCookies.token;

    spotify.me(accessToken, (err, response) => {
       if (err) {
           console.error(err);
           return utils.errorPage(res, 'An error occured. Please try again later.');
       }

       let avatar = '/img/brand.png';
       if (response.images.length > 0) {
           avatar = response.images[0].url;
       }

        let displayName = response.display_name;
        if (!displayName || response.trim().length === 0) {
            displayName = response.id;
        }

       db.getPlaylist(response.id, (err, activePlaylist) => {
          if (err) {
              console.error(err);
              return utils.errorPage(res, 'An error occured. Please try again later.');
          }

           spotify.playlists(accessToken, (err, response) => {
               if (err) {
                   console.error(err);
                   return utils.errorPage(res, 'An error occured. Please try again later.');
               }

               let playlistItems = [];
               let playlists = response.items;
               for (let i = 0; i < playlists.length; i++) {
                   let playlist = playlists[i];

                   if (playlist.owner.id !== 'spotify') {
                       continue;
                   }

                   if (playlist.tracks.total !== 30) {
                       continue;
                   }

                   playlistItems.push({uri: playlist.external_urls.spotify, name: playlist.name, id: playlist.id, active: playlist.id === activePlaylist});
               }

               return res.render('config', {avatar: avatar, username: displayName, playlists: playlistItems, playlistsFound: playlistItems.length > 0});
           });
       });
    });
});

app.get('/login', (req, res) => {
    let scopes = 'playlist-read-private playlist-modify-private';
    let redirectUri = config.applicationHost + '/callback';
    let state = utils.generateToken(16);

    res.cookie('state', state, {signed: true, maxAge: 15 * 60000, httpOnly: true, secure: config.secureCookies});

    res.redirect('https://accounts.spotify.com/authorize?' +
        querystring.stringify({
            'response_type': 'code',
            'client_id': config.clientId,
            'scope': scopes,
            'redirect_uri': redirectUri,
            'state': state
        }));
});

app.get('/callback', (req, res) => {
    if ((!req.query.state || !req.signedCookies.state) || req.query.state !== req.signedCookies.state) {
        return res.redirect('/unauthorized');
    }

    if (req.query.error === 'access_denied') {
        return res.redirect('/unauthorized');
    } else if (req.query.code) {
        let code = req.query.code;

        spotify.getToken(code, (err, response) => {
            if (err) {
                console.error('Failed to get token:', err);
                return utils.errorPage(res, 'The Spotify authorization failed. Please try again later.');
            }

            db.setToken(response.access_token, response.refresh_token, response.expires_in, (err) => {
                if (err) {
                    console.error('Failed to save token to database:', err);
                    return utils.errorPage(res, 'The Spotify authorization failed. Please try again later.');
                }

                res.cookie('token', response.access_token, {signed: true, maxAge: 30 * 60000, httpOnly: true, secure: config.secureCookies});
                return res.redirect('/config');
            });
        });
    } else {
        return res.redirect('/unauthorized');
    }
});

app.post('/api/setplaylist', (req, res) => {
    if (!req.query.id) {
        return res.status(400).send('Invalid request. Playlist id missing.');
    }

    if (!req.signedCookies.token) {
        return res.status(400).send('Invalid request. Authorization missing.');
    }

    spotify.me(req.signedCookies.token, (err, response) => {
        if (err) {
            console.error('Failed to get user data:', err);
            return res.status(500).send('Failed to get user data');
        }

        spotify.isPlaylistValid(req.signedCookies.token, req.query.id, (err) => {
            if (err) {
                console.error('Failed to check playlist:', err);
                return res.status(500).send('Failed to verify playlist');
            }

            db.setPlaylist(response.id, req.query.id);
            return res.send('OK');
        });
    });
});

console.log('Listening on :80');
app.listen(80);
setInterval(householding, 60 * 60000);