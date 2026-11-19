import os
import zipfile
import sys

def create_project_zip():
    base_dir = r"c:\project\medical\pharmacy-management-system"
    zip_filename = r"c:\project\medical\pharmacy-management-system\metapharsic-pharmacy-complete.zip"

    # Directories to exclude
    exclude_dirs = {
        'node_modules',
        '.next',
        '.git',
        '.swc',
        'scratch',
        '.system_generated'
    }

    # Files to exclude (like the zip itself or temporary log files)
    exclude_files = {
        'metapharsic-pharmacy-complete.zip',
        'tsconfig.tsbuildinfo'
    }

    print(f"Creating complete zip archive: {zip_filename}")
    file_count = 0
    total_uncompressed_bytes = 0

    with zipfile.ZipFile(zip_filename, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as zipf:
        for root, dirs, files in os.walk(base_dir):
            # Modify dirs in-place to prevent os.walk from descending into excluded directories
            dirs[:] = [d for d in dirs if d not in exclude_dirs]

            for file in files:
                if file in exclude_files or file.endswith('.tmp') or file.endswith('.log'):
                    continue

                full_path = os.path.join(root, file)
                rel_path = os.path.relpath(full_path, base_dir)

                # Ensure consistent forward slashes in zip
                archive_name = rel_path.replace(os.sep, '/')

                try:
                    file_size = os.path.getsize(full_path)
                    zipf.write(full_path, archive_name)
                    file_count += 1
                    total_uncompressed_bytes += file_size
                except Exception as e:
                    print(f"Warning: could not add {rel_path}: {e}")

    zip_size_bytes = os.path.getsize(zip_filename)
    print("\n" + "="*60)
    print("SUCCESS: Zip archive successfully created!")
    print(f"Archive Path:       {zip_filename}")
    print(f"Total Files Packed: {file_count}")
    print(f"Uncompressed Size:  {total_uncompressed_bytes / (1024*1024):.2f} MB")
    print(f"Compressed Size:    {zip_size_bytes / (1024*1024):.2f} MB")
    print("="*60)

if __name__ == '__main__':
    create_project_zip()
