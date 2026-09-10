"""
Project folders: create, open, save.

A project holds its raw sources next to its output, so it is self-contained and can be
zipped and handed to someone else. Layout:

    <root>/<name>/
        civart.json                 the manifest -- the only file the GUI edits
        project/                    raw inputs the modder imports
            textures/  meshes/  audio/  materials/
        built/                      generated; safe to delete
            DLC/<name>/             >>> paste into <game install>/DLC/
            Mods/<name>/            >>> paste into <userdata>/Mods/

The two output folders are named after where they go on purpose. Art packages are only
ever found in the game install's DLC folder -- the Mods folder is not searched for them
-- and getting that wrong produces no error at all, just "No Packages found for
project" buried in ArtDef.log. A folder called DLC is harder to misread than a warning
in a readme.
"""
import os, json, uuid, shutil, re
from dataclasses import dataclass

MANIFEST = 'civart.json'
SOURCE_DIRS = ('textures', 'meshes', 'audio', 'materials')

# One .dep Element per package we ship. Declare only what is built, but every one that
# is -- an undeclared library is never looked for, and a declared-but-absent one is a
# missing file. Hashes are fixed engine constants.
LIBRARIES = {
    'StandardAsset': ('StandardAsset', 3471015496),
    'UI':            ('UI',            2079568635),
    'Material':      ('TiledMaterialLibrary', 3419754368),
}
CIV7_ART_ID = 'F5D94984-9531-46FF-92D9-3B65894F212B'

# Written into every .dep we generate; see dep_xml for why.
GENERATED_MARKER = '<!-- CUSTOM MODDED -->'


def default_root():
    """~/Documents/CivVIIArt, falling back to ~/CivVIIArt where there is no Documents."""
    if os.environ.get('CIV7_ART_PROJECTS'):
        return os.environ['CIV7_ART_PROJECTS']
    home = os.path.expanduser('~')
    docs = os.path.join(home, 'Documents')
    return os.path.join(docs if os.path.isdir(docs) else home, 'CivVIIArt')


def empty_manifest(name, display_name=None, author=''):
    return {
        'project': {
            'name': name,
            'guid': str(uuid.uuid4()).upper(),
            'displayName': display_name or name,
            'author': author,
            'version': '1',
        },
        'buildings': [], 'binArt': [], 'improvements': [], 'wonders': [],
        'units': [], 'meshes': [], 'soundbanks': [], 'audioEvents': [],
        'clones': [], 'uiTextures': [], 'materials': [],
    }


@dataclass
class Project:
    path: str
    manifest: dict

    # -- identity ----------------------------------------------------------

    @property
    def name(self):
        return self.manifest['project']['name']

    @property
    def manifest_path(self):
        return os.path.join(self.path, MANIFEST)

    def source_dir(self, kind):
        return os.path.join(self.path, 'project', kind)

    @property
    def dlc_dir(self):
        return os.path.join(self.path, 'built', 'DLC', self.name)

    @property
    def mods_dir(self):
        return os.path.join(self.path, 'built', 'Mods', self.name)

    @property
    def blp_dir(self):
        return os.path.join(self.dlc_dir, 'Platforms', 'Windows', 'BLPs')

    @property
    def shared_data_dir(self):
        return os.path.join(self.blp_dir, 'SHARED_DATA')

    # -- lifecycle ---------------------------------------------------------

    @classmethod
    def create(cls, root, name, display_name=None, author=''):
        if not re.fullmatch(r'[A-Za-z0-9_-]+', name or ''):
            raise ValueError('project name must be letters, digits, dashes and '
                             'underscores only -- it becomes the DLC folder name')
        path = os.path.join(root, name)
        if os.path.exists(os.path.join(path, MANIFEST)):
            raise FileExistsError(f'a project already exists at {path}')
        p = cls(path, empty_manifest(name, display_name, author))
        p.scaffold()
        p.save()
        return p

    @classmethod
    def open(cls, path):
        manifest_path = os.path.join(path, MANIFEST)
        if not os.path.exists(manifest_path):
            raise FileNotFoundError(f'no {MANIFEST} in {path}')
        with open(manifest_path) as f:
            return cls(path, json.load(f))

    @classmethod
    def list(cls, root):
        """Every project folder under root, newest manifest first."""
        if not os.path.isdir(root):
            return []
        found = []
        for entry in os.scandir(root):
            manifest = os.path.join(entry.path, MANIFEST)
            if entry.is_dir() and os.path.exists(manifest):
                found.append({'name': entry.name, 'path': entry.path,
                              'modified': os.path.getmtime(manifest)})
        return sorted(found, key=lambda p: p['modified'], reverse=True)

    def scaffold(self):
        for kind in SOURCE_DIRS:
            os.makedirs(self.source_dir(kind), exist_ok=True)
        os.makedirs(self.shared_data_dir, exist_ok=True)
        os.makedirs(os.path.join(self.mods_dir, 'modules'), exist_ok=True)

    def save(self):
        os.makedirs(self.path, exist_ok=True)
        # Write beside the target and replace, so an interrupted save cannot leave a
        # half-written manifest where the only copy of the project's content used to be.
        tmp = self.manifest_path + '.tmp'
        with open(tmp, 'w') as f:
            json.dump(self.manifest, f, indent=2)
            f.write('\n')
        os.replace(tmp, self.manifest_path)

    # -- deployment descriptors -------------------------------------------

    def dep_xml(self, packages):
        """
        The .dep names the art group and the libraries it ships.

        Declaring a library whose package is missing, or shipping a package whose
        library is undeclared, both end in the same silence -- so this is generated
        from the set of packages actually built rather than maintained by hand.
        """
        p = self.manifest['project']
        elements = []
        for pkg in packages:
            lib, lib_hash = LIBRARIES[pkg]
            elements.append(
                '\t\t<Element>\n'
                f'\t\t\t<LibraryName text="{lib}"/>\n'
                f'\t\t\t<LibraryHash>{lib_hash}</LibraryHash>\n'
                '\t\t\t<PackageNames>\n'
                f'\t\t\t\t<Element text="{pkg}"/>\n'
                '\t\t\t</PackageNames>\n'
                '\t\t</Element>')
        return (
            '<?xml version="1.0" encoding="UTF-8" ?>\n'
            # Marks this art group as one we generated, so tooling can tell it apart
            # from a shipped DLC. Donor selection needs that: an installed mod sitting
            # in DLC/ is a perfectly valid package and often a small one, so it wins
            # the smallest-sufficient-donor contest and quietly makes the next build
            # depend on the last one's output.
            f'{GENERATED_MARKER}\n'
            '<AssetObjects..GameDependencyData>\n'
            '\t<ID>\n'
            f'\t\t<name text="{p["name"]}"/>\n'
            f'\t\t<id text="{p["guid"]}"/>\n'
            '\t</ID>\n'
            '\t<RequiredGameArtIDs>\n'
            '\t\t<Element>\n'
            '\t\t\t<name text="Civ7"/>\n'
            f'\t\t\t<id text="{CIV7_ART_ID}"/>\n'
            '\t\t</Element>\n'
            '\t</RequiredGameArtIDs>\n'
            '\t<LibraryDependencies>\n' + '\n'.join(elements) + '\n'
            '\t</LibraryDependencies>\n'
            '</AssetObjects..GameDependencyData>\n')

    def modinfo_xml(self):
        """
        UpdateArt resolves art groups globally rather than relative to the mod, so one
        art group can serve both scopes; both ActionGroups reference the same item.
        """
        p = self.manifest['project']
        return (
            '<?xml version="1.0" encoding="utf-8"?>\n'
            f'<Mod id="{p["name"]}" version="{p["version"]}"\n'
            '\txmlns="ModInfo">\n'
            '\t<Properties>\n'
            f'\t\t<Name>{p["displayName"]}</Name>\n'
            f'\t\t<Authors>{p["author"]}</Authors>\n'
            '\t\t<Package>Mod</Package>\n'
            '\t</Properties>\n'
            '\t<Dependencies>\n'
            '\t\t<Mod id="base-standard" title="LOC_MODULE_BASE_STANDARD_NAME" />\n'
            '\t</Dependencies>\n'
            '\t<ActionCriteria>\n'
            '\t\t<Criteria id="always">\n'
            '\t\t\t<AlwaysMet></AlwaysMet>\n'
            '\t\t</Criteria>\n'
            '\t</ActionCriteria>\n'
            '\t<ActionGroups>\n'
            f'\t\t<ActionGroup id="{p["name"]}-game" scope="game" criteria="always">\n'
            '\t\t\t<Actions>\n'
            f'\t\t\t\t<UpdateArt><Item>{p["name"]}</Item></UpdateArt>\n'
            '\t\t\t</Actions>\n'
            '\t\t</ActionGroup>\n'
            f'\t\t<ActionGroup id="{p["name"]}-shell" scope="shell" criteria="always">\n'
            '\t\t\t<Properties>\n'
            '\t\t\t\t<LoadOrder>550</LoadOrder>\n'
            '\t\t\t</Properties>\n'
            '\t\t\t<Actions>\n'
            f'\t\t\t\t<UpdateArt><Item>{p["name"]}</Item></UpdateArt>\n'
            '\t\t\t</Actions>\n'
            '\t\t</ActionGroup>\n'
            '\t</ActionGroups>\n'
            '</Mod>\n')

    # -- imports -----------------------------------------------------------

    def import_source(self, kind, src_path, rename=None):
        """Copy a raw asset into project/<kind>/ and return its new path."""
        if kind not in SOURCE_DIRS:
            raise ValueError(f'unknown source kind {kind!r}')
        dest_dir = self.source_dir(kind)
        os.makedirs(dest_dir, exist_ok=True)
        dest = os.path.join(dest_dir, rename or os.path.basename(src_path))
        shutil.copy2(src_path, dest)
        return dest
