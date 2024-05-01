import os
import base64
from pymongo import MongoClient

client = MongoClient('localhost', 27017)
db = client.petsy

def store_pet_image(pet_id, image_path):
    with open(image_path, 'rb') as f:
        image_data = f.read()

    base64_image = base64.b64encode(image_data).decode('utf-8')

    db.pet_data.update_one({'petId': pet_id}, {'$set': {'image_data': base64_image}}, upsert=True)
    print(f"Image stored for pet with ID {pet_id}")

folder_path = 'D:\Adoption-pet\Pet-Adoption\datas\pet_pics'

for filename in os.listdir(folder_path):
    if filename.endswith('.jpg') or filename.endswith('.jpeg') or filename.endswith('.png'):
        pet_id = int(os.path.splitext(filename)[0])
        image_path = os.path.join(folder_path, filename)
        store_pet_image(pet_id, image_path)
