# [keepmydiscoverweekly](https://keepmydiscoverweekly.ml)
Automatically archives Spotify's Discover Weekly playlist.

Simply login with your Spotify account, select the playlist you want to archive and wait. 
If the playlist changes, KeepMyDiscoverWeekly will notice it within an hour and create a playlist
called `Archived Discover Weekly YEAR-WEEK` with the contents of your Discover Weekly playlist.

### Setting up your own instance
Setting up your own instance of KeepMyDiscoverWeekly is fairly simple.
- Create a Spotify application in the [Spotify Developer Dashboard](https://developer.spotify.com/my-applications/) and copy the client id and secret
- Create a file called `config.json` inside the working directory with the following content:
```
{
  "clientId": "<Insert your client id here>",
  "clientSecret": "<Insert your client secret here>",
  "applicationHost": "<Insert the url of your application>",
  "cookieSecret": "<Insert a random character sequence>",
  "secureCookies": true
}
```
> You should use https to secure your instance. If you choose not to, make sure to disable `secureCookies` in the config.

- Start the application with `npm start`
