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

const request = require('request'),
    config = require('../config.json');

const API_BASE = 'https://api.spotify.com';

function getUrl(url) {
    return API_BASE + url;
}

function defaultApiRequest(url, accessToken, cb) {
    request.get(getUrl(url),
        {auth: {bearer: accessToken}},
        cb
    );
}

function me(accessToken, cb) {
    defaultApiRequest('/v1/me', accessToken, (err, response, body) => {
        if (err) {
            return cb(err);
        }

        if (!response || response.statusCode !== 200) {
            console.error(body);
            return cb('Invalid http response: ' + response.statusCode);
        }

        return cb(false, JSON.parse(body));
    });
}

module.exports = {
    getToken: (code, cb) => {
        request.post('https://accounts.spotify.com/api/token',
            {form: {'grant_type': 'authorization_code', 'code': code, 'redirect_uri': config.applicationHost + '/callback',
                    'client_id': config.clientId, 'client_secret': config.clientSecret}},
            (err, response, body) => {
                if (err) {
                    return cb(err);
                }

                if (!response || response.statusCode !== 200) {
                    console.error(body);
                    return cb('Invalid http response: ' + response.statusCode);
                }

                return cb(false, JSON.parse(body));
            }
        );
    },
    refreshToken: (refreshToken, cb) => {
        request.post('https://accounts.spotify.com/api/token',
            {form: {'grant_type': 'refresh_token', 'refresh_token': refreshToken,
                    'client_id': config.clientId, 'client_secret': config.clientSecret}},
            (err, response, body) => {
                if (err) {
                    return cb(err);
                }

                if (!response || response.statusCode !== 200) {
                    console.error(body);
                    return cb('Invalid http response: ' + response.statusCode);
                }

                return cb(false, JSON.parse(body));
            }
        );
    },

    me: me,
    playlists: (accessToken, cb) => {
        defaultApiRequest('/v1/me/playlists?limit=50', accessToken, (err, response, body) => {
            if (err) {
                return cb(err);
            }

            if (!response || response.statusCode !== 200) {
                console.error(body);
                return cb('Invalid http response: ' + response.statusCode);
            }

            return cb(false, JSON.parse(body));
        });
    },

    isPlaylistValid: (accessToken, playlistId, cb) => {
        defaultApiRequest('/v1/users/spotify/playlists/' + playlistId, accessToken, (err, response, body) => {
            if (err) {
                return cb(err);
            }

            if (!response || response.statusCode !== 200) {
                console.error(body);
                return cb('Invalid http response: ' + response.statusCode);
            }

            return cb(false);
        });
    },

    getPlaylistTracks: (accessToken, playlistId, cb) => {
        defaultApiRequest('/v1/users/spotify/playlists/' + playlistId + '/tracks?limit=30', accessToken, (err, response, body) => {
            if (err) {
                return cb(err);
            }

            if (!response || response.statusCode !== 200) {
                console.error(body);
                return cb('Invalid http response: ' + response.statusCode);
            }

            return cb(false, JSON.parse(body));
        });
    },

    createPlaylist: (accessToken, name, cb) => {
        me(accessToken, (err, response) => {
            if (err) {
                return cb(err);
            }

            request.post(getUrl('/v1/users/' + response.id + '/playlists'),
                {auth: {bearer: accessToken}, json: {name: name, description: 'Archived Discover Weekly playlist', public: false}},
                (err, response, body) => {
                    if (err) {
                        return cb(err);
                    }

                    if (!response || response.statusCode !== 201) {
                        console.error(body);
                        return cb('Invalid http response: ' + response.statusCode);
                    }

                    return cb(false, body);
                }
            );
        });
    },

    addTracks: (accessToken, tracksUrl, tracks, cb) => {
        request.post(tracksUrl + '?uris=' + encodeURIComponent(tracks),
            {auth: {bearer: accessToken}},
            (err, response, body) => {
                if (err) {
                    return cb(err);
                }

                if (!response || response.statusCode !== 201) {
                    console.error(body);
                    return cb('Invalid http response: ' + response.statusCode);
                }

                return cb(false);
            }
        );
    }

};