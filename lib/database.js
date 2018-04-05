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

const sqlite3 = require('sqlite3').verbose(),
    spotify = require('./spotify');

const db = new sqlite3.Database('database.sqlite3');
db.run("CREATE TABLE IF NOT EXISTS users (userid VARCHAR, token VARCHAR, refreshtoken VARCHAR, tokenexpiry INTEGER, playlist VARCHAR, lastcheck INTEGER, playlistchecksum VARCHAR)");

module.exports = {
    setToken: (accessToken, refreshToken, expiry, cb) => {
        spotify.me(accessToken, (err, response) => {
            if (err) {
                return cb(err);
            }

            let userId = response.id;

            db.all('SELECT token FROM users WHERE userid=?', [userId], (err, rows) => {
                if (err) {
                    return cb(err);
                }

                if (rows.length > 0) {
                    let stmt = db.prepare("UPDATE users SET token=?, refreshtoken=?, tokenexpiry=? WHERE userid=?");
                    stmt.run(accessToken, refreshToken, Date.now() + expiry * 1000, userId);
                    stmt.finalize();
                } else {
                    let stmt = db.prepare("INSERT INTO users VALUES (?, ?, ?, ?, ?, ?, ?)");
                    stmt.run(response.id, accessToken, refreshToken, Date.now() + expiry * 1000, null, 0, null);
                    stmt.finalize();
                }

                return cb(false);
            })
        });
    },

    setPlaylist: (userId, playlistId) => {
        let stmt = db.prepare("UPDATE users SET playlist=? WHERE userid=?");
        stmt.run(playlistId, userId);
        stmt.finalize();
    },

    getPlaylistsToUpdate: (cb) => {
        let timestamp = Date.now() - 24 * 60000;
        db.all('SELECT token, refreshtoken, tokenexpiry, playlist, playlistchecksum FROM users WHERE lastcheck < ?', [timestamp], (err, rows) => {
            if (err) {
                return cb(err);
            }

            let playlists = [];

            for (let i = 0; i < rows.length; i++) {
                playlists.push({token: rows[i].token, refreshToken: rows[i].refreshtoken,
                    tokenExpiry: rows[i].tokenexpiry, id: rows[i].playlist, checksum: rows[i].playlistchecksum});
            }

            return cb(false, playlists);
        });
    },

    insertPlaylistCheck: (playlistId, checksum) => {
        let stmt = db.prepare("UPDATE users SET lastcheck=?, playlistchecksum=? WHERE playlist=?");
        stmt.run(Date.now(), checksum, playlistId);
        stmt.finalize();
    }
};
