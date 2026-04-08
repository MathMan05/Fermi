# How to add your instance to Fermi Client
Inside of `webpage` you'll see a file called `instances.json` in that file you'll need to add your instance and its information in the following format if you want your instance to be a part of the dropdown.
```
{
    "name":<name>,
    "description"?:<A short description>,
    "descriptionLong"?:<A description for the instance that can be longer>,
    "image"?:<URL to image representing your instance>,
    "url"?:<The URL that can be used to get your wellknown>,
    "language":<What language your server is in>,
    "country":<What country your server is in>,
    "display":<True or false depending on wether it should display>,
    "urls"?:{
        "wellknown":<wellknown URL>,
        "api":<API URL>,
        "cdn":<CDN URL>,
        "gateway":<gateway URL>,
        "login"?:<The URL that's used for login>
    },
    "contactInfo"?:{
        "discord"?:<Discord @>,
        "github"?:<Github profile URL>,
        "email"?:<Email address>,
        "harmony":?:<Harmony username>,
        "matrix"?:<Matrix account>,
        "mastodon"?:<Mastodon account>
    }
}
```
Anything with a `?` in-front of its `:` are optional, though you must either include `"URL"` or `"URLs"`, but you may include both, though the client will most likely ignore `"URLs"` in favor of `"URL"`, though it may use `"URLs"` as a fallback if `"URL"` does not resolve, do not rely on this behavior.
`wellknown` should be a url that can resolve, but it should only be the base URL and not the full wellknown URL.
Some of these values may not be used right now, though they will likely be used in the future, so feel free to fill out what you like, though the more you fill out the more information we can give the users about your instance in the future.
`language` should be [ISO 639-1](https://en.wikipedia.org/wiki/ISO_639-1_codes).
`country` should be [ISO 8166-2 alpha-2](https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2).

# Questions
## Do I have to do this to let Fermi Client connect to my server?
No, you may choose to not do this, this just makes it easier for people using Fermi Client to find and use your instance as it's in the dropdown menu for instances, though the user may enter any instance they please.
## If my instance isn't Harmony is that allowed to be entered?
If it's Harmony compatible then yes, it may be entered. Though if there are **too many incompatibilities** however, it may not be included, or may need a warning of sorts.
## I'm hosting my own instance of Harmony and would like to change the default instance on my instance of Fermi Client to my own instance.
Just change the first entry in the list to your own, and it should connect without issue.
## Why would I put my instance in this list over the official Harmony list?
While putting your instance in the other list will get it to show up on Fermi client, this list does have more settings, and will show up earlier in the results, though either list will work to get in the dropdown menu.
