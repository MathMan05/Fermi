import { Permissions } from "./permissions.js";
class Buttons {
    name;
    buttons;
    bigtable;
    warndiv;
    constructor(name) {
        this.buttons = [];
        this.name = name;
    }
    add(name, thing = undefined) {
        if (!thing) {
            thing = new Options(name, this);
        }
        this.buttons.push([name, thing]);
        return thing;
    }
    generateHTML() {
        const bigtable = document.createElement("div");
        bigtable.classList.add("Buttons");
        bigtable.classList.add("flexltr");
        this.bigtable = bigtable;
        const htmlarea = document.createElement("div");
        const buttonTable = document.createElement("div");
        buttonTable.classList.add("flexttb", "settingbuttons");
        for (const thing of this.buttons) {
            const button = document.createElement("button");
            button.classList.add("SettingsButton");
            button.textContent = thing[0];
            button.onclick = _ => {
                this.generateHTMLArea(thing[1], htmlarea);
                if (this.warndiv) {
                    this.warndiv.remove();
                }
            };
            buttonTable.append(button);
        }
        this.generateHTMLArea(this.buttons[0][1], htmlarea);
        bigtable.append(buttonTable);
        bigtable.append(htmlarea);
        return bigtable;
    }
    handleString(str) {
        const div = document.createElement("div");
        div.textContent = str;
        return div;
    }
    generateHTMLArea(genation, htmlarea) {
        let html;
        if (genation instanceof Options) {
            html = genation.generateHTML();
        }
        else {
            html = this.handleString(genation);
        }
        htmlarea.innerHTML = "";
        htmlarea.append(html);
    }
    changed(html) {
        this.warndiv = html;
        this.bigtable.append(html);
    }
    save() { }
}
class PermisionToggle {
    rolejson;
    permissions;
    owner;
    constructor(roleJSON, permissions, owner) {
        this.rolejson = roleJSON;
        this.permissions = permissions;
        this.owner = owner;
    }
    generateHTML() {
        const div = document.createElement("div");
        div.classList.add("setting");
        const name = document.createElement("span");
        name.textContent = this.rolejson.readableName;
        name.classList.add("settingsname");
        div.append(name);
        div.append(this.generateCheckbox());
        const p = document.createElement("p");
        p.innerText = this.rolejson.description;
        div.appendChild(p);
        return div;
    }
    generateCheckbox() {
        const div = document.createElement("div");
        div.classList.add("tritoggle");
        const state = this.permissions.getPermision(this.rolejson.name);
        const on = document.createElement("input");
        on.type = "radio";
        on.name = this.rolejson.name;
        div.append(on);
        if (state === 1) {
            on.checked = true;
        }
        ;
        on.onclick = _ => {
            this.permissions.setPermision(this.rolejson.name, 1);
            this.owner.changed();
        };
        const no = document.createElement("input");
        no.type = "radio";
        no.name = this.rolejson.name;
        div.append(no);
        if (state === 0) {
            no.checked = true;
        }
        ;
        no.onclick = _ => {
            this.permissions.setPermision(this.rolejson.name, 0);
            this.owner.changed();
        };
        if (this.permissions.hasDeny) {
            const off = document.createElement("input");
            off.type = "radio";
            off.name = this.rolejson.name;
            div.append(off);
            if (state === -1) {
                off.checked = true;
            }
            ;
            off.onclick = _ => {
                this.permissions.setPermision(this.rolejson.name, -1);
                this.owner.changed();
            };
        }
        return div;
    }
}
class RoleList extends Buttons {
    permissions;
    permission;
    guild;
    channel;
    options;
    onchange;
    curid;
    constructor(permissions, guild, onchange, channel = false) {
        super("Roles");
        this.guild = guild;
        this.permissions = permissions;
        this.channel = channel;
        this.onchange = onchange;
        const options = new Options("", this);
        if (channel) {
            this.permission = new Permissions("0", "0");
        }
        else {
            this.permission = new Permissions("0");
        }
        for (const thing of Permissions.info) {
            options.addPermisionToggle(thing, this.permission); //
        }
        for (const i of permissions) {
            this.buttons.push([guild.getRole(i[0]).name, i[0]]); //
        }
        this.options = options;
    }
    handleString(str) {
        this.curid = str;
        const perm = this.permissions.find(_ => _[0] === str)[1];
        this.permission.deny = perm.deny;
        this.permission.allow = perm.allow;
        this.options.name = this.guild.getRole(str).name;
        this.options.haschanged = false;
        return this.options.generateHTML();
    }
    save() {
        this.onchange(this.curid, this.permission);
    }
}
class Options {
    name;
    haschanged = false;
    options;
    owner;
    constructor(name, owner) {
        this.name = name;
        this.options = [];
        this.owner = owner;
    }
    addPermisionToggle(roleJSON, permissions) {
        this.options.push(new PermisionToggle(roleJSON, permissions, this));
    }
    generateHTML() {
        const div = document.createElement("div");
        div.classList.add("titlediv");
        const title = document.createElement("h2");
        title.textContent = this.name;
        div.append(title);
        title.classList.add("settingstitle");
        const table = document.createElement("div");
        table.classList.add("flexttb", "flexspace");
        for (const thing of this.options) {
            table.append(thing.generateHTML());
        }
        div.append(table);
        return div;
    }
    changed() {
        if (!this.haschanged) {
            const div = document.createElement("div");
            div.classList.add("flexltr", "savediv");
            const span = document.createElement("span");
            div.append(span);
            span.textContent = "Careful, you have unsaved changes";
            const button = document.createElement("button");
            button.textContent = "Save changes";
            div.append(button);
            this.haschanged = true;
            this.owner.changed(div);
            button.onclick = _ => {
                this.owner.save();
                div.remove();
            };
        }
    }
}
class Settings extends Buttons {
    static Buttons = Buttons;
    static Options = Options;
    html;
    constructor(name) {
        super(name);
    }
    addButton(name) {
        const options = new Options(name, this);
        this.add(name, options);
        return options;
    }
    show() {
        const background = document.createElement("div");
        background.classList.add("background");
        const title = document.createElement("h2");
        title.textContent = this.name;
        title.classList.add("settingstitle");
        background.append(title);
        background.append(this.generateHTML());
        const exit = document.createElement("span");
        exit.textContent = "✖";
        exit.classList.add("exitsettings");
        background.append(exit);
        exit.onclick = _ => { this.hide(); };
        document.body.append(background);
        this.html = background;
    }
    hide() {
        this.html.remove();
        this.html = null;
    }
}
export { Settings, RoleList };
