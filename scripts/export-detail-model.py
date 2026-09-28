"""Export a current Blender scene as a web-ready Draco-compressed GLB.

Run with Blender in background mode and pass one output basename plus the
destination folder after ``--``. The source .blend is read only; texture
resizing changes only the temporary Blender process used for export.
"""

from pathlib import Path
import sys

import bpy


def arguments_after_separator():
    try:
        values = sys.argv[sys.argv.index("--") + 1 :]
    except ValueError as error:
        raise SystemExit("Pass an asset name and output folder after --") from error
    if len(values) < 2:
        raise SystemExit(
            "Usage: blender -b scene.blend --python export-detail-model.py -- "
            "<asset-name> <output-folder> [--exclude <object-name>]..."
        )
    if (len(values) - 2) % 2:
        raise SystemExit("Each optional exclusion must be written as --exclude <object-name>")
    exclusions = []
    for option, object_name in zip(values[2::2], values[3::2]):
        if option != "--exclude":
            raise SystemExit(f"Unknown option: {option}")
        exclusions.append(object_name)
    return values[0], values[1], exclusions


asset_name, output_folder, exclusions = arguments_after_separator()
output_path = Path(output_folder).resolve()
output_path.mkdir(parents=True, exist_ok=True)

# Some source scenes include an enormous distant backdrop (for example a river
# surface hundreds of metres wide). Hide only such named objects in this
# temporary Blender process so they cannot overwhelm the browser viewer's
# automatic fit. The original .blend is never saved or modified.
hidden_objects = []
for object_name in exclusions:
    obj = bpy.data.objects.get(object_name)
    if obj is None:
        raise SystemExit(f"Cannot exclude missing Blender object: {object_name}")
    obj.hide_set(True)
    hidden_objects.append(object_name)

# Cap very large source maps for web delivery. This is an in-memory change;
# the original .blend is never saved or overwritten.
max_texture_edge = 1024
resized_images = []
for image in bpy.data.images:
    if image.source != "FILE" or image.size[0] <= 0 or image.size[1] <= 0:
        continue
    largest_edge = max(image.size)
    if largest_edge > max_texture_edge:
        ratio = max_texture_edge / largest_edge
        new_size = (max(1, round(image.size[0] * ratio)), max(1, round(image.size[1] * ratio)))
        image.scale(*new_size)
        resized_images.append({"name": image.name, "size": list(new_size)})

available = {prop.identifier for prop in bpy.ops.export_scene.gltf.get_rna_type().properties}
settings = {
    "filepath": str(output_path / f"{asset_name}.glb"),
    "export_format": "GLB",
    "export_image_format": "WEBP",
    "export_image_quality": 90,
    "export_yup": True,
    "export_apply": True,
    "export_cameras": True,
    "export_lights": False,
    "export_extras": False,
    "export_animations": False,
    "use_selection": False,
    "use_visible": True,
}

# Mesh compression is supported by Blender's bundled glTF exporter in the
# Blender version used for this portfolio. Keep graceful fallback for versions
# whose add-on does not expose Draco options.
if "export_draco_mesh_compression_enable" in available:
    settings.update(
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=6,
        export_draco_position_quantization=14,
        export_draco_normal_quantization=10,
        export_draco_texcoord_quantization=12,
        export_draco_color_quantization=8,
        export_draco_generic_quantization=12,
    )

bpy.ops.export_scene.gltf(**settings)
print(
    "PORTFOLIO_GLB_EXPORT="
    + str(
        {
            "path": settings["filepath"],
            "bytes": Path(settings["filepath"]).stat().st_size,
            "draco": settings.get("export_draco_mesh_compression_enable", False),
            "resized_images": resized_images,
            "hidden_objects": hidden_objects,
        }
    )
)
