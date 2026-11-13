For the project contributing policies see here\: https://docs.melodychat.org/contributing/

Information just for Fermi:
* Fermi is on a low to no dependency policy, so unless a dependency is required we don't want to use it
	* Build time dependencies get more leeway, but are still discouraged
* Use the helper functions, there are a lot of them
* Some files are harder to understand than others:
	* `index.ts`
	* `localuser.ts`
		* only some parts, though this is planned to be fixed
	* `voice.ts`
	* anything under `audio/`

This is some codebase cleanup planned within Fermi, notably `localuser.ts` is planned to be split up some more for future plans, and `index.ts` is planned to be further reduced in role. The audio engine is likely to be either reworked or expanded on, either way, please ask before trying to improve/fix it.
